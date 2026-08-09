/**
 * Writing, annotating and removing ticks.
 *
 * **The write happens when the outcome is chosen** — there is no draft, no confirm and nothing held
 * in component state. §4 requires every tap to persist immediately because sessions are logged in
 * fragments, between climbs; an uncommitted tick is a tick you lose when someone hands you a rope.
 *
 * That makes annotation an `UPDATE` of a row that already exists (§7.1). It is also the safe
 * operation: the storage layer's design requires outcome changes to go through `put`, because a
 * partial of a discriminated union is unsound — but `notes`, `angle`, `holds`, `rating`,
 * `grade_opinion` and `length_m` are all outside the union, so `update` is correct for them.
 */

import { isLabel, type ScaleId } from '@tickd/grade-spec';
import { newId, type TickdDatabase } from './schema.ts';
import { localDateOf, tzOffsetOf } from './sessions.ts';
import type { Tick, TickDiscipline, TickGrade, TickOutcome } from './types.ts';

/**
 * What the screen knows when a cell is tapped.
 *
 * **The draft carries the row's unions, not loose fields.** It used to declare `grade_scale: ScaleId`
 * beside `grade_raw: string` and `discipline` beside `protection`, which decoupled exactly the pairs
 * `types.ts` exists to keep together — and `logTick` then cast the result back with `as Tick`. Every
 * assertion in `writes.assert.ts` is written against `db.ticks.add`, so the cast walked straight past
 * all of them: `logTick(db, { discipline: 'boulder', protection: 'lead', … })` typechecked and
 * persisted. The invariant was advertised on the row type and absent from the only path that writes
 * one. Found by review; `writes.assert.ts` now asserts against this type too.
 */
export type TickDraft = {
  readonly session_id: string;
  readonly outcome: TickOutcome;
} & TickGrade &
  TickDiscipline;

/**
 * Pairs a label with the scale it was read off, or `undefined` if the two do not belong together.
 *
 * The boundary where a `string` from the DOM becomes a `TickGrade`. It has to be checked rather than
 * asserted: the grid renders one scale's labels, but nothing in the type of a click handler proves
 * the label came from the grid that is currently mounted, and the discipline toggle used to be able
 * to swap the scale out from under a pending pick.
 *
 * The `switch` is what does the narrowing — `isLabel(raw, scale)` on a union-typed `scale` proves
 * nothing about which member of `TickGrade` results.
 */
export function gradeOf(raw: string, scale: ScaleId): TickGrade | undefined {
  switch (scale) {
    case 'french':
      return isLabel(raw, 'french') ? { grade_scale: 'french', grade_raw: raw } : undefined;
    case 'font':
      return isLabel(raw, 'font') ? { grade_scale: 'font', grade_raw: raw } : undefined;
  }
}

/**
 * The fields annotation may touch — everything outside the outcome and the grade.
 *
 * Each is `?: T | undefined` rather than `Partial<Pick<…>>`, because under
 * `exactOptionalPropertyTypes` those mean different things: absent is "leave it alone", explicit
 * `undefined` is "clear it". Clearing an angle you tapped by mistake is a real operation, so the type
 * has to be able to say it.
 */
export interface TickAnnotation {
  readonly notes?: string | undefined;
  readonly angle?: Tick['angle'] | undefined;
  readonly holds?: Tick['holds'] | undefined;
  readonly rating?: Tick['rating'] | undefined;
  readonly grade_opinion?: Tick['grade_opinion'] | undefined;
  readonly length_m?: number | undefined;
}

/**
 * Writes a tick.
 *
 * `date_local` and `tz_offset` come from the moment of logging rather than from the session, because
 * a climb belongs to the local day it was climbed (§7.7) — log at 00:15 and the tick is Saturday's
 * even though the session began on Friday.
 */
export async function logTick(
  db: TickdDatabase,
  draft: TickDraft,
  now: Date = new Date(),
): Promise<Tick> {
  const at = now.getTime();
  // Destructured rather than spread whole, so `outcome` is not carried into the row as a stray
  // column. `climb` keeps both paired halves intact — no cast anywhere in here, which is the change
  // that makes the assertions in `writes.assert.ts` apply to this function at all.
  const { session_id, outcome, ...climb } = draft;

  const tick: Tick = {
    ...climb,
    ...outcome,
    id: newId(),
    session_id,
    date_local: localDateOf(now),
    tz_offset: tzOffsetOf(now),
    created_at: at,
    updated_at: at,
  };

  await db.ticks.add(tick);
  return tick;
}

/** Adds optional detail to a tick that already exists. Never required, never blocking. */
export async function annotateTick(
  db: TickdDatabase,
  id: string,
  annotation: TickAnnotation,
  now: Date = new Date(),
): Promise<void> {
  await db.ticks.update(id, { ...annotation, updated_at: now.getTime() });
}

/**
 * Removes a tick.
 *
 * Correction is a plain `DELETE` (§7.1) — no tombstone, nothing to reconcile. Undo is first-class
 * because a two-tap interface maximises mis-taps (§3), so this is the common path rather than an
 * exceptional one.
 */
export async function removeTick(db: TickdDatabase, id: string): Promise<void> {
  await db.ticks.delete(id);
}

/** Ticks of a session, most recent first — what the undo list shows. */
export async function recentTicks(db: TickdDatabase, sessionId: string): Promise<Tick[]> {
  const ticks = await db.ticks.where('session_id').equals(sessionId).toArray();
  return ticks.sort((a, b) => b.created_at - a.created_at);
}
