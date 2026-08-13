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
import type {
  RopedProtection,
  RopedTick,
  Tick,
  TickDiscipline,
  TickGrade,
  TickOutcome,
} from './types.ts';

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
 * Correcting the three fields `annotateTick` cannot reach.
 *
 * **Three narrow functions rather than one general one.** A single `correctTick(db, id, { grade, climb,
 * outcome })` would accept all three parts and then have to police two relationships at runtime: that the
 * grade's scale matches the row's, and that the discipline does not move. Split up, the type system
 * enforces both — `correctGrade` reads the scale off the row instead of taking one, and
 * `correctProtection` takes a `RopedTick`, so a boulder is a compile error at the call site.
 *
 * **There is deliberately no `correctClimb`.** The absence of the function is what forbids a
 * cross-discipline correction; a function taking a `TickDiscipline` would make the wrong correction
 * expressible and then need to reject it. Correcting a boulder to a roped go would leave a Font label
 * under a French scale at the venues that grade the two differently, and converting between the notations
 * is deferred (D17). So a go logged under the wrong discipline stays wrong — stated in the specs rather
 * than papered over here.
 *
 * **Each reads the row it is about to write, inside a transaction.** The caller's copy proves *intent* —
 * that this is a roped tick, at compile time — but it cannot be trusted as *current*: `AnnotationPanel`
 * writes to the same row through `annotateTick` once per keystroke while the sheet is open, and these
 * write the whole row through `put`. A `put` built from a copy taken before a note was typed would erase
 * the note, which is the one field with no other copy. Reading fresh closes that window entirely, so the
 * guards below are guards rather than cases.
 *
 * `put` rather than `update` because a partial of a discriminated union is unsound — the same reason
 * `TickAnnotation` stops where it does. The whole row goes back, which is also why nothing may be built
 * from anything but the row just read.
 */

/** Writes a corrected row back, stamping `updated_at`. `created_at` never moves — see `correctGrade`. */
async function writeCorrected(db: TickdDatabase, next: Tick, now: Date): Promise<Tick> {
  const corrected: Tick = { ...next, updated_at: now.getTime() };
  await db.ticks.put(corrected);
  return corrected;
}

/**
 * Re-grades a tick, **within the notation it already carries**.
 *
 * The scale is read off the fresh row rather than supplied, so it cannot change: `grade_scale` appears
 * nowhere in the parameters. `gradeOf` is the same boundary the logging screen uses — a label arriving
 * from a click handler carries no proof of which grid rendered it, so it is checked rather than asserted.
 *
 * `undefined` means the correction was refused and nothing was written: the row is gone, or the label is
 * not one of that scale's. Case is all that separates Font `6A` from French `6a`, so a cross-scale write
 * would silently record a different climb.
 *
 * `created_at`, `date_local` and `tz_offset` are carried across untouched, because a climb belongs to the
 * local day it was climbed (§7.7). A correction that re-stamped them would move a Tuesday go to whichever
 * day the mistake was noticed, unrepairably in a phase with no migrations.
 */
export async function correctGrade(
  db: TickdDatabase,
  tick: Tick,
  raw: string,
  now: Date = new Date(),
): Promise<Tick | undefined> {
  return db.transaction('rw', db.ticks, async () => {
    const fresh = await db.ticks.get(tick.id);
    if (!fresh) {
      return undefined;
    }
    const grade = gradeOf(raw, fresh.grade_scale);
    if (!grade) {
      return undefined;
    }
    // Both halves of the pair replaced together. Spread over the row's own union, so no cast is needed
    // and `writes.assert.ts` applies to what this builds.
    return writeCorrected(db, { ...fresh, ...grade }, now);
  });
}

/**
 * Changes how a roped tick was protected — `lead`, `toprope` or `autobelay`.
 *
 * This is the correction the first test session asked for: `protection` is sticky, so a toprope lap logged
 * without switching it records as lead, and the mistake is noticed several goes later when undo would mean
 * deleting from the middle of the evening.
 *
 * `discipline` is absent from the parameters, so it cannot move, and `RopedProtection` cannot express
 * `none` — which *means* boulder. The `RopedTick` parameter makes the call site prove the tick is roped;
 * the guard on `fresh` re-establishes it for the row actually being written.
 */
export async function correctProtection(
  db: TickdDatabase,
  tick: RopedTick,
  protection: RopedProtection,
  now: Date = new Date(),
): Promise<Tick | undefined> {
  return db.transaction('rw', db.ticks, async () => {
    const fresh = await db.ticks.get(tick.id);
    if (!fresh || fresh.protection === 'none') {
      return undefined;
    }
    return writeCorrected(db, { ...fresh, protection }, now);
  });
}

/**
 * Re-records how the go went.
 *
 * Unconstrained: all six pairings of `prior_experience` and `is_send` are valid, so there is nothing to
 * police. Both fields move together because `TickOutcome` is written whole — and because a control
 * reaching only `prior_experience` would leave a go recorded as not sent when it was sent permanently
 * wrong.
 *
 * This is the correction with a metric behind it. `prior_experience` is flash rate's denominator, so a
 * phantom first encounter inflates the rate at exactly the grade the metric exists to find (§4.2, D14).
 */
export async function correctOutcome(
  db: TickdDatabase,
  tick: Tick,
  outcome: TickOutcome,
  now: Date = new Date(),
): Promise<Tick | undefined> {
  return db.transaction('rw', db.ticks, async () => {
    const fresh = await db.ticks.get(tick.id);
    if (!fresh) {
      return undefined;
    }
    return writeCorrected(db, { ...fresh, ...outcome }, now);
  });
}

/**
 * Removes a tick.
 *
 * **This is undo, not correction.** A delete is a plain `DELETE` (§7.1) — no tombstone, nothing to
 * reconcile — and it is first-class because a two-tap interface maximises mis-taps (§3), so this is the
 * common path rather than an exceptional one. Repairing a go that is worth keeping is the `correct*`
 * path above, which edits in place: delete-and-relog would append the go at the end of the evening and
 * re-stamp it with the day the mistake was noticed (D23).
 */
export async function removeTick(db: TickdDatabase, id: string): Promise<void> {
  await db.ticks.delete(id);
}

/** Ticks of a session, most recent first — what the undo list shows. */
export async function recentTicks(db: TickdDatabase, sessionId: string): Promise<Tick[]> {
  const ticks = await db.ticks.where('session_id').equals(sessionId).toArray();
  return ticks.sort((a, b) => b.created_at - a.created_at);
}
