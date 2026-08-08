/**
 * The Phase 0 local database.
 *
 * The client is the source of truth: Dexie/IndexedDB serves every read, and there is no network at
 * all in Phase 0 (`CONCEPT.md` §8, §9.0).
 *
 * **There is exactly one version and there will never be a second.** Phase 0 data is disposable by
 * design, so a schema change wipes and restarts rather than migrating (D7, §7.6). Migration
 * discipline begins at Phase 1, when the data becomes worth keeping. `schema.test.ts` asserts the
 * single version, so reaching for `version(2)` fails the build instead of quietly smuggling in
 * migration logic.
 */

import Dexie, { type Table } from 'dexie';
import type {
  Session,
  Tick,
  TickBase,
  TickDiscipline,
  TickGrade,
  TickOutcome,
  Venue,
  VenueBase,
  VenueScales,
} from './types.ts';

/**
 * Index choices, and what is deliberately *not* indexed.
 *
 * `[discipline+grade_scale]` exists because **every metric groups by that pair** (§4.2, D17).
 * Grouping by discipline alone pools Font and French boulders into one ranking of incomparable
 * values; grouping by scale alone pools boulders with routes. Either produces a plausible wrong
 * number rather than an error, so the correct query is made the convenient one.
 *
 * Nothing else is indexed. A month of single-user ticks is a few hundred rows: `tags` gets no
 * `*multiEntry` index because no Phase 0 query reads it, and `grade_raw` gets none because grades are
 * grouped in memory once the compound index has narrowed the set.
 *
 * `date_local` is a `YYYY-MM-DD` string, which indexes correctly because lexicographic order is
 * chronological order.
 *
 * `venue_id` is **not** indexed on ticks, because the column no longer exists (D19). A venue-scoped
 * query goes through that venue's sessions.
 */
const STORES = {
  venues: 'id, name, brand, city',
  sessions: 'id, venue_id, date_local',
  ticks: 'id, session_id, date_local, [discipline+grade_scale]',
} as const;

/**
 * Every field the schema stores, listed exhaustively.
 *
 * The `satisfies Record<StoredField, true>` is the mechanism: `StoredField` is derived from the row
 * types themselves — distributing over the unions so a key on any single member counts — so **adding
 * a field to a row makes this object fail to compile until the field is listed**. That in turn
 * changes the fingerprint below, and therefore the schema marker.
 */
type KeysOf<T> = T extends unknown ? keyof T : never;
type StoredField =
  | KeysOf<TickBase>
  | KeysOf<TickGrade>
  | KeysOf<TickOutcome>
  | KeysOf<TickDiscipline>
  | KeysOf<VenueBase>
  | KeysOf<VenueScales>
  | KeysOf<Session>;

const STORED_FIELDS = {
  id: true,
  session_id: true,
  discipline: true,
  protection: true,
  grade_opinion: true,
  rating: true,
  notes: true,
  length_m: true,
  angle: true,
  holds: true,
  date_local: true,
  tz_offset: true,
  created_at: true,
  updated_at: true,
  grade_scale: true,
  grade_raw: true,
  is_send: true,
  prior_experience: true,
  type: true,
  name: true,
  brand: true,
  city: true,
  country: true,
  geo: true,
  default_route_length_m: true,
  default_scale_rope: true,
  default_scale_boulder: true,
  pending_review: true,
  canonical_id: true,
  venue_id: true,
  started_at: true,
  ended_at: true,
} satisfies Record<StoredField, true>;

/** FNV-1a, 32-bit. Not cryptographic — it only has to change when its input does. */
function fingerprint(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Identifies the shape of an exported file.
 *
 * Lives here rather than in the importer because it identifies *the schema*, and the schema is
 * defined here. The importer compares against it and **refuses a mismatch rather than upgrading**,
 * since upgrading would be a Dexie migration by another name (§7.6).
 *
 * **Derived, not hand-maintained.** It was previously the literal `'tickd.phase0.v1'` with a test
 * asserting it equalled that literal — which tested nothing and actively rewarded leaving it alone.
 * Add a required field to `Tick`, forget to bump the constant, and an export from the old shape would
 * import cleanly into the new one, defeating the refusal that D7 relies on instead of migrations.
 * Found by review.
 *
 * Now it hashes the store definitions *and* the exhaustive field list, so both an index change and a
 * field change move it on their own. `schema.test.ts` pins the current value, so the change is
 * announced rather than silent — but the developer can no longer fail to make it.
 */
export const SCHEMA_MARKER = `tickd.phase0-${fingerprint(
  JSON.stringify(STORES) + Object.keys(STORED_FIELDS).sort().join(','),
)}`;

/** The database name. Exported so tests can open and delete isolated instances. */
export const DB_NAME = 'tickd';

/**
 * Primary keys are client-generated UUIDs rather than Dexie auto-increment.
 *
 * Auto-increment keys are per-database counters, which collide the moment a second device exists —
 * and Phase 1 sync is the stated destination (§8.3). A UUID costs nothing now and avoids a rekey
 * later.
 *
 * **`crypto.randomUUID` is secure-context only**, so it is absent over plain http — which is exactly
 * the stated device-testing route, a phone hitting the Vite dev server at `http://192.168.x.x:5173`.
 * Calling it unguarded threw `TypeError` on the first id minted, so a tap that is supposed to persist
 * immediately would silently do nothing. An earlier comment justified the missing fallback with a
 * jsdom measurement, which is the wrong environment to measure. Found by review.
 *
 * `crypto.getRandomValues` has no secure-context restriction, so the fallback is exact rather than
 * degraded: the same 122 random bits, the same RFC 4122 version and variant nibbles.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // Version 4 and the RFC 4122 variant, so the fallback is indistinguishable from the native output.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Tables are typed `Table<Row, string, Row>` — **not** `EntityTable<Row, 'id'>`.
 *
 * This is load-bearing and was found by review after the original typing shipped. `EntityTable`
 * derives its insert type from the row with an `Omit` of the primary key, and `Omit` over a union
 * keeps only the keys common to every member and merges their property types. That **flattens**
 * `Tick` and `Venue`, so `db.ticks.add({ is_send: false, send_style: 'flash', ... })` typechecked
 * cleanly even though the identical literal annotated `const t: Tick` did not.
 *
 * The consequence was that every invariant in `types.ts` held for the row types and evaporated at
 * the only ingress that matters: `add`, `put`, `bulkPut` and `update` are how the logging screen
 * writes. An attempt carrying a send style would have compiled, shipped, and permanently inflated
 * the flash-rate numerator — exactly the corruption D14 exists to prevent.
 *
 * Naming the insert type explicitly as the full row keeps the union intact. Nothing is lost by it:
 * ids are client-generated (`newId`), so a caller always supplies one anyway.
 *
 * `writes.assert.ts` pins this down by asserting through the tables rather than through the row
 * types, which is the gap that let it through the first time.
 */
export type TickdDatabase = Dexie & {
  venues: Table<Venue, string, Venue>;
  sessions: Table<Session, string, Session>;
  ticks: Table<Tick, string, Tick>;
};

export function createDatabase(name: string = DB_NAME): TickdDatabase {
  const db = new Dexie(name) as TickdDatabase;
  // One version. No `.upgrade()`. See the file header.
  db.version(1).stores(STORES);
  return db;
}

export const db = createDatabase();
