/**
 * The export file: what it contains, how it is written, and the three ways it can be refused.
 *
 * `CONCEPT.md` §7.6 makes export and import a pair — an export nobody can import is an archive, not a
 * restore path — and gives the importer two rules that this module implements: **it replaces rather
 * than merges**, and **a schema-marker mismatch is refused rather than upgraded**. Merging would mean
 * inventing the identity and conflict rules Phase 1 owns; upgrading would be a Dexie migration by
 * another name, which is exactly what D7 exchanged for disposable Phase 0 data.
 *
 * **The third refusal is the digest, and it is here instead of per-field validation.**
 *
 * The marker answers *"is this file from my schema?"*. It cannot answer *"is this file true to my
 * schema?"*, because JSON expresses rows the type system makes unrepresentable: a boulder carrying
 * `protection: 'lead'` passes every marker check and then corrupts the `(discipline, grade_scale)` key
 * that every metric groups by. Import is the only write path in this app with no compiler behind it —
 * `Table<Row, string, Row>` guards the others, and `writes.assert.ts` pins that down — so something has
 * to stand in for the compiler here.
 *
 * A validator mirroring the row unions would be that something, and it would be a second copy of the
 * invariants, free to drift from the first. A digest is not: it accepts exactly the files this app
 * wrote and refuses every edit, including the ones a validator would have had to enumerate. The cost is
 * stated rather than hidden — **an export can no longer be hand-repaired** — and that cost is close to a
 * feature, since the repair most likely to be attempted is editing a marker to defeat the refusal above.
 *
 * **It is FNV-1a rather than SHA-256**, reusing `fingerprint` from the schema module. `crypto.subtle` is
 * secure-context-only — the same trap `newId` documents having been caught by — so a `SubtleCrypto`
 * digest would throw on `http://192.168.x.x:5173`, the stated route for testing on a phone, while
 * working perfectly in production. The threat model is a user who opened their own export in an editor,
 * not an attacker, and 32 bits detects that with room to spare.
 */

import { fingerprint, SCHEMA_MARKER } from '../../db/schema.ts';
import { readLogbook, type LogbookPayload } from '../../db/logbook.ts';
import { localDateOf } from '../../db/sessions.ts';
import type { TickdDatabase } from '../../db/schema.ts';

/**
 * The file's shape: an envelope around the payload.
 *
 * The three envelope fields sit **outside** the payload, which is what lets the digest cover the payload
 * without covering itself.
 */
export interface LogbookExport {
  /** The schema this was written from. Compared, never migrated. */
  readonly marker: string;
  /** ISO instant. Shown in the import confirmation so the file can be identified before it replaces anything. */
  readonly exported_at: string;
  /** FNV-1a over `JSON.stringify(payload)`. */
  readonly digest: string;
  readonly payload: LogbookPayload;
}

/** How many rows a file or a database holds — the numbers both confirmations are built from. */
export interface LogbookCounts {
  readonly venues: number;
  readonly sessions: number;
  readonly ticks: number;
}

/**
 * The digest, computed the one way both sides must agree on.
 *
 * Over the **parsed payload**, never over the file's text. That is what makes it insensitive to
 * formatting — re-indenting or minifying a file changes the text and not the parse, so an export that
 * has been through a code formatter still imports — while staying sensitive to any changed value and to
 * reordered keys. Hashing the text would refuse a file someone opened and saved with a trailing newline,
 * which is a false alarm, and false alarms are how a check like this gets ignored.
 */
export function digestOf(payload: LogbookPayload): string {
  return fingerprint(JSON.stringify(payload));
}

/** Reads the whole logbook into a file body. */
export async function buildExport(db: TickdDatabase, now: Date): Promise<LogbookExport> {
  const payload = await readLogbook(db);
  return {
    marker: SCHEMA_MARKER,
    exported_at: now.toISOString(),
    digest: digestOf(payload),
    payload,
  };
}

/**
 * `tickd-2026-08-15.json`.
 *
 * Dated, because undated files collide in a downloads folder and give no way to tell which is the
 * newest — which is the only question anyone asks of an export they are about to restore. The local
 * date rather than the ISO instant, and `localDateOf` rather than a second formatter, for the same
 * reason `date_local` exists at all: the day something happened is a local question.
 */
export function exportFileName(now: Date): string {
  return `tickd-${localDateOf(now)}.json`;
}

/** Why a file was refused. Each has its own message; none of them is "invalid file". */
export type ImportRefusal = 'unparseable' | 'marker' | 'digest';

export type ImportResult =
  | {
      readonly ok: true;
      readonly payload: LogbookPayload;
      readonly counts: LogbookCounts;
      readonly exported_at: string;
    }
  | { readonly ok: false; readonly refusal: ImportRefusal };

/** Whether an unknown value has the envelope's shape. Structural only — it says nothing about rows. */
function isEnvelope(value: unknown): value is LogbookExport {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  // Read through `unknown` rather than `Partial<LogbookExport>`: a partial of the envelope already
  // asserts the field types, so the guards below would be checking what the cast had assumed.
  const { marker, exported_at, digest, payload } = value as Record<keyof LogbookExport, unknown>;
  if (typeof marker !== 'string' || typeof exported_at !== 'string' || typeof digest !== 'string') {
    return false;
  }
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }
  const { venues, sessions, ticks } = payload as Record<keyof LogbookPayload, unknown>;
  return Array.isArray(venues) && Array.isArray(sessions) && Array.isArray(ticks);
}

/**
 * Reads a file, refusing it three ways.
 *
 * The refusals happen **before** anything is shown to the user for confirmation, which is what lets the
 * confirmation state numbers it has actually verified rather than numbers it hopes are true. The
 * alternative ordering produces the worst version of this screen: a dialog promising to replace 412
 * ticks, followed by a failure.
 *
 * The envelope check is structural and deliberately shallow — it establishes that this is a tickd export
 * at all. It is not the row validation this module declines to do; a file that gets past it is trusted
 * because of the digest, not because of the shape check.
 */
export function parseImport(text: string, marker: string = SCHEMA_MARKER): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, refusal: 'unparseable' };
  }

  if (!isEnvelope(parsed)) {
    return { ok: false, refusal: 'unparseable' };
  }

  if (parsed.marker !== marker) {
    return { ok: false, refusal: 'marker' };
  }

  if (digestOf(parsed.payload) !== parsed.digest) {
    return { ok: false, refusal: 'digest' };
  }

  const { payload } = parsed;
  return {
    ok: true,
    payload,
    counts: {
      venues: payload.venues.length,
      sessions: payload.sessions.length,
      ticks: payload.ticks.length,
    },
    exported_at: parsed.exported_at,
  };
}

/**
 * Hands the file to the browser.
 *
 * A `Blob` and a programmatic `<a download>` click, which works in an installed standalone PWA — where
 * there is no browser chrome to save from. `showSaveFilePicker` would be a nicer experience (it can put
 * the file straight into Drive) and is Chromium-only, so it needs this path as its fallback anyway: two
 * code paths where one suffices, in the one feature whose whole purpose is being reliable.
 */
export function downloadExport(file: LogbookExport, name: string): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  // Revoking immediately is safe: the click has already handed the blob to the download.
  URL.revokeObjectURL(url);
}
