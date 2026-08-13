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
import type { correctGrade, correctOutcome, correctProtection, TickDraft } from './ticks.ts';
import type { Tick, TickBase, TickDiscipline, TickGrade, Venue } from './types.ts';

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

/**
 * The style assertions that stood here are gone, and their absence is the point.
 *
 * They proved that `add` rejected an attempt carrying a send style and a flash after prior
 * experience. D20 removed `send_style`, so neither shape can be expressed at the write path or
 * anywhere else — asserting their rejection would assert something trivially true of any nonexistent
 * field.
 *
 * What still needs proving is that **the write path did not quietly widen**: that every valid outcome
 * reaches the table, and that the insert type is still the row type rather than a flattened
 * derivative. The second is the regression this file was created for.
 */
// Explicit for the same reason as `types.assert.ts`: a generic helper defers the conditional and
// resolves to `boolean`, which `AssertAssignable` can never satisfy and which would therefore fail
// loudly rather than silently — but a helper that always fails is no more useful than one that never
// does.

export type FirstEncounterSentIsInsertable = AssertAssignable<
  IsAssignable<BaseFields & FrenchGrade & { is_send: true; prior_experience: 'none' }, TickAdd>
>;
export type FirstEncounterNotSentIsInsertable = AssertAssignable<
  IsAssignable<BaseFields & FrenchGrade & { is_send: false; prior_experience: 'none' }, TickAdd>
>;
export type AttemptedSentIsInsertable = AssertAssignable<
  IsAssignable<BaseFields & FrenchGrade & { is_send: true; prior_experience: 'attempted' }, TickAdd>
>;
export type AttemptedNotSentIsInsertable = AssertAssignable<
  IsAssignable<
    BaseFields & FrenchGrade & { is_send: false; prior_experience: 'attempted' },
    TickAdd
  >
>;
export type RepeatSentIsInsertable = AssertAssignable<
  IsAssignable<BaseFields & FrenchGrade & { is_send: true; prior_experience: 'sent' }, TickAdd>
>;
export type RepeatNotSentIsInsertable = AssertAssignable<
  IsAssignable<BaseFields & FrenchGrade & { is_send: false; prior_experience: 'sent' }, TickAdd>
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

/** `put` and `bulkPut` are not a way around the invariants that remain. */
export type CrossScaleIsNotPuttable = AssertNotAssignable<
  IsAssignable<
    BaseFields & { grade_scale: 'french'; grade_raw: '6A' } & {
      is_send: true;
      prior_experience: 'none';
    },
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

// ── The draft is part of the write path ──────────────────────────────────────────────────────────

/**
 * `logTick` is the only way a tick is written, so `TickDraft` is where the invariants have to hold.
 *
 * Everything above asserts against `db.ticks.add`. That was necessary and not sufficient: `logTick`
 * built its row from four independent fields and cast the result with `as Tick`, so the assertions
 * held while the one function that used them walked past every one. `logTick(db, { discipline:
 * 'boulder', protection: 'lead', … })` compiled and persisted. These assert the draft directly, so
 * re-decoupling either pair is a compile error here rather than a corrupt row in a phase that
 * cannot migrate.
 */
interface DraftFields {
  session_id: string;
  outcome: { is_send: true; prior_experience: 'none' };
}

export type ValidDraftIsLoggable = AssertAssignable<
  IsAssignable<DraftFields & FrenchGrade & { discipline: 'sport'; protection: 'lead' }, TickDraft>
>;

export type BoulderDraftIsLoggable = AssertAssignable<
  IsAssignable<
    DraftFields & { grade_scale: 'font'; grade_raw: '6A' } & {
      discipline: 'boulder';
      protection: 'none';
    },
    TickDraft
  >
>;

/** The row the discipline toggle used to write when it was tapped between the two taps. */
export type CrossScaleDraftIsNotLoggable = AssertNotAssignable<
  IsAssignable<
    DraftFields & { grade_scale: 'font'; grade_raw: '6a' } & {
      discipline: 'boulder';
      protection: 'none';
    },
    TickDraft
  >
>;

export type BoulderOnLeadIsNotLoggable = AssertNotAssignable<
  IsAssignable<DraftFields & FrenchGrade & { discipline: 'boulder'; protection: 'lead' }, TickDraft>
>;

export type RopeWithoutProtectionIsNotLoggable = AssertNotAssignable<
  IsAssignable<DraftFields & FrenchGrade & { discipline: 'sport'; protection: 'none' }, TickDraft>
>;

/** A venue offering neither discipline is not a venue. */
export type ScalelessVenueIsNotInsertable = AssertNotAssignable<
  IsAssignable<VenueFields, VenueAdd>
>;

// ── Correction is a write path, so it carries the same obligation ────────────────────────────────

/**
 * The three correction helpers, asserted through their **parameter types** like everything above.
 *
 * A correction writes the whole row through `put`, so it is exactly as capable of persisting a
 * contradictory pair as `logTick` was before its cast was removed. What is asserted here is narrower than
 * for the draft, and deliberately so: the correction helpers do not *take* the fields that could
 * contradict each other. `correctGrade` takes a bare `string` and pairs it against the scale it reads off
 * the row, so there is no scale parameter to mismatch; `correctProtection` takes no `discipline`, so there
 * is none to move. The assertions therefore prove the shape of the *interface* — that a boulder cannot
 * reach the protection helper, and that `none` cannot be offered as a protection — because that shape is
 * what stands in for a validator.
 *
 * There is no `correctClimb` to assert against, which is the point: a cross-discipline correction is
 * unrepresentable because the function does not exist, not because a check rejects it.
 */
type CorrectProtectionTick = Parameters<typeof correctProtection>[1];
type CorrectProtectionValue = Parameters<typeof correctProtection>[2];
type CorrectGradeValue = Parameters<typeof correctGrade>[2];
type CorrectOutcomeValue = Parameters<typeof correctOutcome>[2];

/** Controls: the valid corrections must still reach the helpers. */
export type RopeTickIsCorrectable = AssertAssignable<
  IsAssignable<
    RopeFields & FrenchGrade & { is_send: true; prior_experience: 'none' },
    CorrectProtectionTick
  >
>;
export type EveryRopedProtectionIsOfferable = AssertAssignable<
  IsAssignable<'lead' | 'toprope' | 'autobelay', CorrectProtectionValue>
>;
export type EveryOutcomeIsCorrectable = AssertAssignable<
  IsAssignable<
    | { is_send: true; prior_experience: 'none' }
    | { is_send: false; prior_experience: 'none' }
    | { is_send: true; prior_experience: 'attempted' }
    | { is_send: false; prior_experience: 'attempted' }
    | { is_send: true; prior_experience: 'sent' }
    | { is_send: false; prior_experience: 'sent' },
    CorrectOutcomeValue
  >
>;

/**
 * A boulder cannot reach the protection helper.
 *
 * This is the compile-time half of "correction never crosses a discipline". The runtime guard on the row
 * the helper reads is the other half, and `ticks.test.ts` covers it by casting past this assertion.
 */
export type BoulderTickIsNotProtectionCorrectable = AssertNotAssignable<
  IsAssignable<
    BoulderFields & { grade_scale: 'font'; grade_raw: '6A' } & {
      is_send: false;
      prior_experience: 'none';
    },
    CorrectProtectionTick
  >
>;

/** `none` *means* boulder, so it is not one of the protections a correction may choose. */
export type NoneIsNotAnOfferableProtection = AssertNotAssignable<
  IsAssignable<'none', CorrectProtectionValue>
>;

/**
 * The grade helper takes a label and no scale.
 *
 * A `TickGrade` parameter would read better and would move the pairing decision to a click handler that
 * has no proof of which grid rendered the label — the hole `gradeOf` exists to close. Asserting the
 * parameter is a plain `string` is how that stays true: if someone widens it to accept a pre-paired grade,
 * this fails.
 */
export type CorrectGradeTakesAnUnpairedLabel = AssertAssignable<
  IsAssignable<CorrectGradeValue, string>
>;
export type CorrectGradeTakesNoPairedGrade = AssertNotAssignable<
  IsAssignable<FrenchGrade, CorrectGradeValue>
>;

// ── Narrowing through the intersection, non-vacuously ────────────────────────────────────────────

/**
 * Narrowing must survive the intersection at the write path too.
 *
 * `sendStyleOf` used to live here, narrowing `is_send` to reach `send_style`. Both are gone: the
 * outcome is a plain record and the style is computed in `style.ts`. What remains to prove is the
 * grade union, and it is proved non-vacuously — each function returns a type only the *narrowed*
 * value satisfies, so a regression is a compile error rather than a silent widening to `string`.
 */
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
