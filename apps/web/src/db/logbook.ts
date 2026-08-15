/**
 * The two whole-database write paths: replace everything, or delete everything.
 *
 * Every other write in this layer touches one row — `logTick`, `annotateTick`, the three `correct*`
 * functions. These two exist for the JSON import and for the settings screen's deletion, and they are
 * kept apart from the per-row paths because their failure mode is different in kind: a half-applied
 * replace is a logbook the user believes is one thing and is another, which is worse than either a
 * successful restore or a refused file.
 *
 * **Neither of these is a migration and neither may become one.** They write the rows they are given,
 * unchanged. Deciding whether a file's rows *belong* in this database is the caller's job, and the
 * caller does it by comparing schema markers and refusing rather than transforming (`CONCEPT.md` §7.6,
 * D7).
 */

import type { TickdDatabase } from './schema.ts';
import type { Session, Tick, Venue } from './types.ts';

/**
 * Every row in the database, which is also exactly what an export carries.
 *
 * **Venues are part of it**, even though they are seeded rather than user-editable and every launch
 * overwrites them. Seeding is a `bulkPut`, which overwrites by id and never deletes — so a venue
 * carried in from an older export survives the reseed that follows an import and keeps its sessions
 * resolvable. Leave venues out and an old file restores sessions pointing at nothing.
 */
export interface LogbookPayload {
  readonly venues: readonly Venue[];
  readonly sessions: readonly Session[];
  readonly ticks: readonly Tick[];
}

/** Reads the whole database, in the shape an export writes and an import consumes. */
export async function readLogbook(db: TickdDatabase): Promise<LogbookPayload> {
  const [venues, sessions, ticks] = await Promise.all([
    db.venues.toArray(),
    db.sessions.toArray(),
    db.ticks.toArray(),
  ]);
  return { venues, sessions, ticks };
}

/**
 * Replaces the entire logbook with the supplied rows.
 *
 * **One transaction over all three tables, so it is all-or-nothing.** The clears and the writes are
 * sequential inside it rather than raced: the ordering is what makes the rollback legible, and a
 * transaction is not a place to save four milliseconds.
 *
 * A failure part-way — quota exhaustion, a row that will not store — rejects out of the transaction
 * scope, which aborts it, which puts the previous logbook back. That is the behaviour the settings
 * screen's confirmation promises, so it is tested directly rather than assumed from Dexie's docs.
 *
 * Rows are written **verbatim**: no new identifiers, no re-stamped timestamps. This is a restore, not
 * a re-log — a tick imported on Thursday keeps the Tuesday it was climbed, for the same reason a
 * correction never moves one.
 */
export async function replaceLogbook(db: TickdDatabase, payload: LogbookPayload): Promise<void> {
  await db.transaction('rw', db.venues, db.sessions, db.ticks, async () => {
    await db.venues.clear();
    await db.sessions.clear();
    await db.ticks.clear();

    await db.venues.bulkPut([...payload.venues]);
    await db.sessions.bulkPut([...payload.sessions]);
    await db.ticks.bulkPut([...payload.ticks]);
  });
}

/**
 * Empties the logbook.
 *
 * **Venues go too**, which is safe because they are not user data: the seed rows are authoritative in
 * Phase 0 (`CONCEPT.md` §7.5) and the next launch's `seedVenues` restores them. Leaving them behind
 * would make the operation harder to describe than to perform — and the description is the point, since
 * this is what deletion and export are defined to have in common: **deleting removes exactly what an
 * export captures.**
 *
 * This exists because Phase 0's answer to a schema change is wipe-and-restart (D7), and on the trial
 * device — an installed PWA on a phone — there is otherwise no way to perform it.
 */
export async function deleteLogbook(db: TickdDatabase): Promise<void> {
  await db.transaction('rw', db.venues, db.sessions, db.ticks, async () => {
    await db.venues.clear();
    await db.sessions.clear();
    await db.ticks.clear();
  });
}
