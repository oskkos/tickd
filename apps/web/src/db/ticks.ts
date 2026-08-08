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

import type { LabelOf, ScaleId } from '@tickd/grade-spec';
import { newId, type TickdDatabase } from './schema.ts';
import { localDateOf, tzOffsetOf } from './sessions.ts';
import type { Discipline, Protection, Tick, TickOutcome } from './types.ts';

/** What the screen knows when a cell is tapped. */
export interface TickDraft {
  readonly session_id: string;
  readonly discipline: Discipline;
  readonly protection: Protection;
  readonly grade_scale: ScaleId;
  readonly grade_raw: string;
  readonly outcome: TickOutcome;
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

  const tick = {
    id: newId(),
    session_id: draft.session_id,
    discipline: draft.discipline,
    protection: draft.protection,
    grade_scale: draft.grade_scale,
    grade_raw: draft.grade_raw as LabelOf<ScaleId>,
    ...draft.outcome,
    date_local: localDateOf(now),
    tz_offset: tzOffsetOf(now),
    created_at: at,
    updated_at: at,
  } as Tick;

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
