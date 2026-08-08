/**
 * Type-level assertions for the **write path**. `tsc --noEmit` is the test.
 *
 * `types.assert.ts` proves the invariants hold for `Tick` and `Venue`. That is not the same claim as
 * "an invalid row cannot be written", and the gap was a real defect rather than a hypothetical: with
 * the tables originally typed `EntityTable<Row, 'id'>`, Dexie derived the insert type via `Omit`,
 * `Omit` over a union collapsed it to the common keys with merged property types, and
 * `db.ticks.add({ is_send: false, send_style: 'flash', ... })` compiled cleanly while the identical
 * literal annotated `const t: Tick` did not.
 *
 * Every assertion in `types.assert.ts` passed against tables that accepted the very rows they
 * forbade. The guarantee that matters is about `add`, `put` and `bulkPut`, so this file asserts
 * against **their parameter types**, read straight off the table objects. If the table typing
 * regresses, these fail — they cannot pass by testing the row type instead.
 */

import { db } from './schema.ts';
import type { Tick, TickBase, TickDiscipline, TickGrade, TickOutcome, Venue } from './types.ts';

type IsAssignable<Candidate, Target> = [Candidate] extends [Target] ? true : false;
type AssertNotAssignable<T extends false> = T;
type AssertAssignable<T extends true> = T;

/**
 * The types Dexie will actually accept, taken from the methods rather than restated. Restating them
 * would re-introduce exactly the bug this file exists to catch.
 */
type TickAdd = Parameters<typeof db.ticks.add>[0];
type TickPut = Parameters<typeof db.ticks.put>[0];
type TickBulkPut = Parameters<typeof db.ticks.bulkPut>[0][number];
type VenueAdd = Parameters<typeof db.venues.add>[0];

/** The insert type must be the row type itself, not a flattened derivative. */
export type TickInsertIsTheRowType = AssertAssignable<IsAssignable<TickAdd, Tick>>;
export type TickPutIsTheRowType = AssertAssignable<IsAssignable<TickPut, Tick>>;
export type TickBulkPutIsTheRowType = AssertAssignable<IsAssignable<TickBulkPut, Tick>>;
export type VenueInsertIsTheRowType = AssertAssignable<IsAssignable<VenueAdd, Venue>>;

type BaseFields = TickBase & { discipline: 'sport'; protection: 'lead' };
interface FrenchGrade {
  grade_scale: 'french';
  grade_raw: '6a';
}

interface VenueFields {
  id: string;
  type: 'indoor';
  name: string;
  city: string;
  country: string;
  pending_review: false;
}

// ── Controls: valid rows must reach the tables ───────────────────────────────────────────────────

export type ValidTickIsInsertable = AssertAssignable<
  IsAssignable<
    BaseFields & FrenchGrade & { is_send: true; send_style: 'flash'; prior_experience: 'none' },
    TickAdd
  >
>;

export type ValidAttemptIsInsertable = AssertAssignable<
  IsAssignable<
    BaseFields & FrenchGrade & { is_send: false; prior_experience: 'attempted' },
    TickAdd
  >
>;

/** Lielahti: boulder-only, so no rope scale at all. */
export type BoulderOnlyVenueIsInsertable = AssertAssignable<
  IsAssignable<VenueFields & { default_scale_boulder: 'french' }, VenueAdd>
>;

// ── The invariants must survive the write path ───────────────────────────────────────────────────

/** An attempt carrying a send style: the write that silently inflates flash rate (§4.2, D14). */
export type AttemptWithSendStyleIsNotInsertable = AssertNotAssignable<
  IsAssignable<
    BaseFields & FrenchGrade & { is_send: false; send_style: 'flash'; prior_experience: 'none' },
    TickAdd
  >
>;

export type FlashAfterSendingIsNotInsertable = AssertNotAssignable<
  IsAssignable<
    BaseFields & FrenchGrade & { is_send: true; send_style: 'flash'; prior_experience: 'sent' },
    TickAdd
  >
>;

export type SendWithoutStyleIsNotInsertable = AssertNotAssignable<
  IsAssignable<BaseFields & FrenchGrade & { is_send: true; prior_experience: 'none' }, TickAdd>
>;

/** Case is the only thing separating the notations, so this records a different climb. */
export type CrossScaleGradeIsNotInsertable = AssertNotAssignable<
  IsAssignable<
    BaseFields & { grade_scale: 'french'; grade_raw: '6A' } & {
      is_send: true;
      send_style: 'flash';
      prior_experience: 'none';
    },
    TickAdd
  >
>;

/** `put` and `bulkPut` are not a way around it either. */
export type InvalidTickIsNotPuttable = AssertNotAssignable<
  IsAssignable<
    BaseFields & FrenchGrade & { is_send: false; send_style: 'flash'; prior_experience: 'none' },
    TickPut
  >
>;

export type InvalidTickIsNotBulkPuttable = AssertNotAssignable<
  IsAssignable<
    BaseFields & { grade_scale: 'font'; grade_raw: '6a' } & {
      is_send: true;
      send_style: 'flash';
      prior_experience: 'none';
    },
    TickBulkPut
  >
>;

/**
 * Discipline and protection cannot contradict each other at the write path either.
 *
 * `protection: 'none'` *means* boulder (§7.4). A row pairing it with `sport`, or pairing `boulder`
 * with a rope protection, is counted inconsistently rather than rejected — it lands in one group of
 * the `[discipline+grade_scale]` index while any consumer reading `protection === 'none'` as
 * "is a boulder" disagrees.
 */
type RopeFields = TickBase & { discipline: 'sport'; protection: 'lead' };
type BoulderFields = TickBase & Extract<TickDiscipline, { discipline: 'boulder' }>;

export type BoulderWithRopeProtectionIsNotInsertable = AssertNotAssignable<
  IsAssignable<
    TickBase & { discipline: 'boulder'; protection: 'lead' } & FrenchGrade & {
        is_send: true;
        send_style: 'flash';
        prior_experience: 'none';
      },
    TickAdd
  >
>;

export type RopeWithoutProtectionIsNotInsertable = AssertNotAssignable<
  IsAssignable<
    TickBase & { discipline: 'sport'; protection: 'none' } & FrenchGrade & {
        is_send: true;
        send_style: 'flash';
        prior_experience: 'none';
      },
    TickAdd
  >
>;

/** Controls, so the two assertions above are not passing because nothing is ever insertable. */
export type RopeTickIsInsertable = AssertAssignable<
  IsAssignable<
    RopeFields & FrenchGrade & { is_send: true; send_style: 'flash'; prior_experience: 'none' },
    TickAdd
  >
>;

export type BoulderTickIsInsertable = AssertAssignable<
  IsAssignable<
    BoulderFields & { grade_scale: 'font'; grade_raw: '6A' } & {
      is_send: false;
      prior_experience: 'attempted';
    },
    TickAdd
  >
>;

/** A venue offering neither discipline is not a venue. */
export type ScalelessVenueIsNotInsertable = AssertNotAssignable<
  IsAssignable<VenueFields, VenueAdd>
>;

// ── Narrowing through the intersection, non-vacuously ────────────────────────────────────────────

/**
 * These replace the earlier `rawOf`/`priorOf`, which were vacuous: both ternary branches returned
 * the same expression and the `string` return type accepted the un-narrowed union, so they compiled
 * whether or not narrowing worked — while being cited as the evidence that it did.
 *
 * Each function below returns a type that only the *narrowed* value satisfies, so narrowing breaking
 * is a compile error rather than a silent widening.
 */
export function sendStyleOf(tick: Tick): TickOutcome['send_style'] {
  return tick.is_send ? tick.send_style : undefined;
}

export function fontLabelOf(
  tick: Tick,
): Extract<TickGrade, { grade_scale: 'font' }>['grade_raw'] | null {
  return tick.grade_scale === 'font' ? tick.grade_raw : null;
}

export function frenchLabelOf(
  tick: Tick,
): Extract<TickGrade, { grade_scale: 'french' }>['grade_raw'] | null {
  return tick.grade_scale === 'french' ? tick.grade_raw : null;
}
