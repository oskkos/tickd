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

import Dexie, { type EntityTable } from 'dexie';
import type { Session, Tick, Venue } from './types.ts';

/**
 * Identifies the shape of an exported file.
 *
 * Lives here rather than in the importer because it identifies *the schema*, and the schema is
 * defined here. The importer compares against it and **refuses a mismatch rather than upgrading**,
 * since upgrading would be a Dexie migration by another name (§7.6). Change this whenever the table
 * shape changes, so an older export is recognisably incompatible instead of silently misread.
 */
export const SCHEMA_MARKER = 'tickd.phase0.v1';

/** The database name. Exported so tests can open and delete isolated instances. */
export const DB_NAME = 'tickd';

/**
 * Primary keys are client-generated UUIDs rather than Dexie auto-increment.
 *
 * Auto-increment keys are per-database counters, which collide the moment a second device exists —
 * and Phase 1 sync is the stated destination (§8.3). A UUID costs nothing now and avoids a rekey
 * later.
 *
 * Wrapped rather than called inline so tests can substitute it. Measured: `crypto.randomUUID` is
 * available under jsdom, so no fallback is needed.
 */
export function newId(): string {
  return crypto.randomUUID();
}

export type TickdDatabase = Dexie & {
  venues: EntityTable<Venue, 'id'>;
  sessions: EntityTable<Session, 'id'>;
  ticks: EntityTable<Tick, 'id'>;
};

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
 */
const STORES = {
  venues: 'id, name, brand, city',
  sessions: 'id, venue_id, date_local',
  ticks: 'id, session_id, venue_id, date_local, [discipline+grade_scale]',
} as const;

export function createDatabase(name: string = DB_NAME): TickdDatabase {
  const db = new Dexie(name) as TickdDatabase;
  // One version. No `.upgrade()`. See the file header.
  db.version(1).stores(STORES);
  return db;
}

export const db = createDatabase();
