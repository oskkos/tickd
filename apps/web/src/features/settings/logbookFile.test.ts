import { afterEach, describe, expect, it, vi } from 'vitest';
import Dexie from 'dexie';
import { createDatabase, newId, SCHEMA_MARKER, type TickdDatabase } from '../../db/schema.ts';
import { replaceLogbook, type LogbookPayload } from '../../db/logbook.ts';
import type { Session, Tick, Venue } from '../../db/types.ts';
import {
  buildExport,
  digestOf,
  downloadExport,
  exportFileName,
  parseImport,
} from './logbookFile.ts';

const opened: TickdDatabase[] = [];
function freshDb() {
  const db = createDatabase(`file-${newId()}`);
  opened.push(db);
  return db;
}

afterEach(async () => {
  while (opened.length > 0) {
    const db = opened.pop();
    if (db) {
      db.close();
      await Dexie.delete(db.name);
    }
  }
});

const VENUES: readonly Venue[] = [
  {
    id: 'v1',
    type: 'indoor',
    name: 'Kiipeilyareena Salmisaari',
    brand: 'Kiipeilyareena',
    city: 'Helsinki',
    country: 'FI',
    default_scale_rope: 'french',
    default_scale_boulder: 'font',
    pending_review: false,
  },
  {
    id: 'v2',
    type: 'indoor',
    name: 'Tampereen Kiipeilykeskus Lielahti',
    city: 'Tampere',
    country: 'FI',
    // Boulder-only, and graded in French — the pairing that proves a scale is a notation (D17).
    default_scale_boulder: 'french',
    pending_review: false,
  },
];

const SESSIONS: readonly Session[] = [
  { id: 's1', venue_id: 'v1', date_local: '2026-08-08', started_at: 1_000, ended_at: 9_000 },
  { id: 's2', venue_id: 'v2', date_local: '2026-08-09', started_at: 20_000 },
];

/**
 * Every arm of every union the row types carry, so a field added to `Tick` and forgotten in the export
 * has somewhere to be missed from.
 *
 * Both scales, all four protections, all six pairings of `prior_experience` and `is_send`, and the
 * optional annotation fields both set and absent.
 */
const TICKS: readonly Tick[] = [
  {
    id: 't1',
    session_id: 's1',
    discipline: 'sport',
    protection: 'lead',
    grade_scale: 'french',
    grade_raw: '6a',
    is_send: true,
    prior_experience: 'none',
    date_local: '2026-08-08',
    tz_offset: 180,
    created_at: 1_100,
    updated_at: 1_100,
    grade_opinion: 'hard',
    rating: 4,
    notes: 'pumpy, greasy jugs',
    length_m: 18,
    angle: 'overhang',
    holds: ['crimp', 'sloper'],
  },
  {
    id: 't2',
    session_id: 's1',
    discipline: 'sport',
    protection: 'toprope',
    grade_scale: 'french',
    grade_raw: '7a+',
    is_send: false,
    prior_experience: 'attempted',
    date_local: '2026-08-08',
    tz_offset: 180,
    created_at: 1_200,
    updated_at: 1_300,
  },
  {
    id: 't3',
    session_id: 's1',
    discipline: 'trad',
    protection: 'autobelay',
    grade_scale: 'french',
    // `5+`, not `5c` — the French scale has no letters below 6a, which the label union enforces.
    grade_raw: '5+',
    is_send: true,
    prior_experience: 'sent',
    date_local: '2026-08-08',
    tz_offset: 180,
    created_at: 1_400,
    updated_at: 1_400,
    angle: 'slab',
  },
  {
    id: 't4',
    session_id: 's2',
    discipline: 'boulder',
    protection: 'none',
    grade_scale: 'font',
    grade_raw: '6A',
    is_send: false,
    prior_experience: 'none',
    date_local: '2026-08-09',
    tz_offset: 180,
    created_at: 20_100,
    updated_at: 20_100,
    holds: ['pinch', 'pocket', 'jug'],
  },
  {
    id: 't5',
    session_id: 's2',
    discipline: 'boulder',
    protection: 'none',
    grade_scale: 'french',
    grade_raw: '6b',
    is_send: false,
    prior_experience: 'sent',
    date_local: '2026-08-09',
    tz_offset: 180,
    created_at: 20_200,
    updated_at: 20_200,
    rating: 1,
  },
  {
    id: 't6',
    session_id: 's2',
    discipline: 'boulder',
    protection: 'none',
    grade_scale: 'font',
    grade_raw: '7B+',
    is_send: true,
    prior_experience: 'attempted',
    date_local: '2026-08-09',
    tz_offset: 180,
    created_at: 20_300,
    updated_at: 20_300,
  },
];

const PAYLOAD: LogbookPayload = { venues: VENUES, sessions: SESSIONS, ticks: TICKS };

async function populated() {
  const db = freshDb();
  await replaceLogbook(db, PAYLOAD);
  return db;
}

const NOW = new Date('2026-08-15T10:38:00.000Z');

describe('buildExport', () => {
  it('carries the envelope outside the payload', async () => {
    const file = await buildExport(await populated(), NOW);

    expect(file.marker).toBe(SCHEMA_MARKER);
    expect(file.exported_at).toBe('2026-08-15T10:38:00.000Z');
    expect(file.digest).toBe(digestOf(file.payload));
    expect(file.payload).not.toHaveProperty('digest');
  });

  it('holds every row of every table', async () => {
    const file = await buildExport(await populated(), NOW);

    expect(file.payload.venues).toHaveLength(VENUES.length);
    expect(file.payload.sessions).toHaveLength(SESSIONS.length);
    expect(file.payload.ticks).toHaveLength(TICKS.length);
  });
});

describe('the round trip', () => {
  it('restores every row, field for field', async () => {
    // The load-bearing test of this module. The digest and the marker are both computed *from* whatever
    // the export chose to include, so neither can notice a field the export forgot — only this can.
    const source = await populated();
    const text = JSON.stringify(await buildExport(source, NOW));

    const result = parseImport(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const restored = freshDb();
    await replaceLogbook(restored, result.payload);

    const byId = <T extends { id: string }>(rows: readonly T[]) =>
      [...rows].sort((a, b) => a.id.localeCompare(b.id));

    expect(byId(await restored.venues.toArray())).toEqual(byId(VENUES));
    expect(byId(await restored.sessions.toArray())).toEqual(byId(SESSIONS));
    expect(byId(await restored.ticks.toArray())).toEqual(byId(TICKS));
  });

  it('does not re-stamp a tick into the day it was imported', async () => {
    const text = JSON.stringify(await buildExport(await populated(), NOW));
    const result = parseImport(text);
    if (!result.ok) throw new Error('expected the file to import');

    const restored = freshDb();
    await replaceLogbook(restored, result.payload);

    const tick = await restored.ticks.get('t1');
    expect(tick?.date_local).toBe('2026-08-08');
    expect(tick?.tz_offset).toBe(180);
    expect(tick?.created_at).toBe(1_100);
    expect(tick?.updated_at).toBe(1_100);
  });

  it('reports the counts and the export date the confirmation is built from', async () => {
    const text = JSON.stringify(await buildExport(await populated(), NOW));
    const result = parseImport(text);
    if (!result.ok) throw new Error('expected the file to import');

    expect(result.counts).toEqual({ venues: 2, sessions: 2, ticks: 6 });
    expect(result.exported_at).toBe('2026-08-15T10:38:00.000Z');
  });
});

describe('the three refusals', () => {
  it('refuses a file that is not JSON', () => {
    expect(parseImport('not json at all')).toEqual({ ok: false, refusal: 'unparseable' });
  });

  it('refuses JSON that is not an export', () => {
    expect(parseImport('{"hello":"world"}')).toEqual({ ok: false, refusal: 'unparseable' });
    expect(parseImport('[]')).toEqual({ ok: false, refusal: 'unparseable' });
  });

  it('refuses a marker from another schema, and does not upgrade it', async () => {
    // D7's substitute for migrations: the file stays readable, and wipe-and-restart is the answer a
    // schema change already has.
    const file = await buildExport(await populated(), NOW);
    const foreign = { ...file, marker: 'tickd.phase0-deadbeef' };

    expect(parseImport(JSON.stringify(foreign))).toEqual({ ok: false, refusal: 'marker' });
  });

  it('refuses a file whose payload was edited', async () => {
    const file = await buildExport(await populated(), NOW);
    // The edit a validator would have had to enumerate: marker-valid, invariant-violating.
    const tampered = JSON.parse(JSON.stringify(file)) as typeof file;
    (tampered.payload.ticks as Tick[])[3] = {
      ...TICKS[3],
      protection: 'lead',
    } as unknown as Tick;

    expect(parseImport(JSON.stringify(tampered))).toEqual({ ok: false, refusal: 'digest' });
  });

  it('refuses a single changed character in a note', async () => {
    const file = await buildExport(await populated(), NOW);
    const text = JSON.stringify(file).replace('pumpy, greasy jugs', 'pumpy, greasy jug');

    expect(parseImport(text)).toEqual({ ok: false, refusal: 'digest' });
  });
});

describe('the digest', () => {
  it('accepts a re-indented file, because formatting is not modification', async () => {
    const file = await buildExport(await populated(), NOW);

    const compact = parseImport(JSON.stringify(file));
    const pretty = parseImport(JSON.stringify(file, null, 4));

    expect(compact.ok).toBe(true);
    expect(pretty.ok).toBe(true);
  });

  it('covers the payload and not itself', async () => {
    const file = await buildExport(await populated(), NOW);
    // Changing the timestamp changes the envelope, not the payload — so it is still importable. The
    // digest is not a signature over the file; it is a check that the rows are the ones that were written.
    const restamped = { ...file, exported_at: '2026-01-01T00:00:00.000Z' };

    expect(parseImport(JSON.stringify(restamped)).ok).toBe(true);
  });

  it('works without a secure context', async () => {
    // `crypto.subtle` is secure-context-only, and the phone tests against the dev server over plain
    // http. This is why the digest is FNV-1a: a SubtleCrypto digest would throw here and nowhere else.
    const subtle = globalThis.crypto.subtle;
    Object.defineProperty(globalThis.crypto, 'subtle', { value: undefined, configurable: true });
    try {
      const file = await buildExport(await populated(), NOW);
      expect(parseImport(JSON.stringify(file)).ok).toBe(true);
    } finally {
      Object.defineProperty(globalThis.crypto, 'subtle', { value: subtle, configurable: true });
    }
  });
});

describe('exportFileName', () => {
  it('carries the local date', () => {
    // Local rather than the ISO instant: which day something happened is a local question, and an
    // undated name collides in a downloads folder with every other export.
    expect(exportFileName(new Date(2026, 7, 15, 13, 38))).toBe('tickd-2026-08-15.json');
  });
});

describe('downloadExport', () => {
  it('hands the browser a named JSON blob', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:tickd');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe('tickd-2026-08-15.json');
      expect(this.href).toContain('blob:tickd');
    });

    downloadExport(await buildExport(await populated(), NOW), 'tickd-2026-08-15.json');

    expect(click).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:tickd');
    click.mockRestore();
  });
});
