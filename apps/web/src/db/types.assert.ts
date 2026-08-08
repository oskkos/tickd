/**
 * Type-level assertions for the tick invariants. `tsc --noEmit` is the test.
 *
 * Same purpose as `packages/grade-spec/src/types.assert.ts` — if someone widens a row type so an
 * invalid state becomes representable, this file fails the build rather than letting it pass
 * silently. The mechanism differs from `grade-spec`'s: see the note above `AssertNotAssignable` for
 * why `@ts-expect-error` does not work for these particular shapes.
 *
 * **This file lost its style assertions and is stronger for it.** They forbade a `send_style` on a
 * non-send and a flash after prior experience. D20 dropped the column and derives the style, so
 * neither shape can be written down at all — the assertions would have been describing a problem the
 * type system no longer permits. What replaces them is the opposite claim: that **all six**
 * `(prior_experience, is_send)` pairings remain valid, so a future narrowing is a build failure.
 *
 * Nothing here runs. It exists to be typechecked.
 */

import type {
  Tick,
  TickBase,
  TickGrade,
  TickOutcome,
  PriorExperience,
  Venue,
  VenueBase,
} from './types.ts';

/** Fields shared by every fixture below, so each case shows only what it is testing. */
const base = {
  id: 'a',
  session_id: 'b',
  // Discipline and protection are one unit: `protection: 'none'` means boulder (§7.4).
  discipline: 'sport',
  protection: 'lead',
  date_local: '2026-08-07',
  tz_offset: 180,
  created_at: 0,
  updated_at: 0,
} as const;

// ── Valid combinations must compile ──────────────────────────────────────────────────────────────

/** Derived as a flash: sent, with nothing before it. */
export const flashOnFirstEncounter: Tick = {
  ...base,
  grade_scale: 'french',
  grade_raw: '6a',
  is_send: true,
  prior_experience: 'none',
};

export const attemptWithNoStyle: Tick = {
  ...base,
  grade_scale: 'french',
  grade_raw: '7a',
  is_send: false,
  prior_experience: 'attempted',
};

/** A repeat on a Font boulder — derived as a redpoint. */
export const fontBoulder: Tick = {
  ...base,
  discipline: 'boulder',
  protection: 'none',
  grade_scale: 'font',
  grade_raw: '6A',
  is_send: true,
  prior_experience: 'sent',
};

/** A French-graded boulder. One discipline spans two scales; a scale is a notation, not a
 *  discipline (D17). This must be as valid as the Font one above. */
export const frenchBoulder: Tick = {
  ...base,
  discipline: 'boulder',
  protection: 'none',
  grade_scale: 'french',
  grade_raw: '6a',
  is_send: true,
  prior_experience: 'none',
};

// ── Invalid combinations must not be assignable ──────────────────────────────────────────────────

/**
 * These are asserted at the type level rather than with `@ts-expect-error`.
 *
 * **Measured reason, not a preference.** An invalid object literal reports its error at different
 * positions depending on which rule it breaks: a wrong `prior_experience` or a Font label under a
 * French scale reports at the *declaration*, while an excess `send_style` reports at the *property*.
 * A `@ts-expect-error` only suppresses the line immediately after it, so half the directives sat on
 * the wrong line and TypeScript flagged them as unused — the assertions would have been testing
 * their own placement rather than the invariant.
 *
 * `AssertNotAssignable` is position-independent. If a guard is widened so an invalid shape becomes
 * assignable, `IsAssignable` resolves to `true`, which does not satisfy `extends false`, and the
 * build fails on that line.
 */
type IsAssignable<Candidate, Target> = [Candidate] extends [Target] ? true : false;
type AssertNotAssignable<T extends false> = T;
type AssertAssignable<T extends true> = T;

type BaseOf = typeof base;
interface FrenchGrade {
  grade_scale: 'french';
  grade_raw: '6a';
}
interface FontGrade {
  grade_scale: 'font';
  grade_raw: '6A';
}

/** A control: the assertion helper must accept a genuinely valid shape, or every `AssertNotAssignable`
 *  below would pass for the trivial reason that nothing is ever assignable. */
export type ControlValidTickIsAssignable = AssertAssignable<
  IsAssignable<BaseOf & FrenchGrade & { is_send: true; prior_experience: 'none' }, Tick>
>;

/** The same control on the other notation, so a regression cannot hide on one scale. */
export type ControlValidFontTickIsAssignable = AssertAssignable<
  IsAssignable<BaseOf & FontGrade & { is_send: false; prior_experience: 'attempted' }, Tick>
>;

// ── Every outcome pairing stays valid ────────────────────────────────────────────────────────────

/**
 * The replacement for the style assertions this file used to carry.
 *
 * They forbade two combinations. After D20 those combinations cannot be written down — `send_style` is
 * gone — so the useful claim inverts: **all six pairings of `prior_experience` and `is_send` must
 * remain valid**. If someone narrows `TickOutcome` back into a union, or pins `prior_experience` for
 * sends, one of these six stops compiling and the build fails.
 *
 * The pairing that matters most is `none` + `is_send: false` — a first encounter that was walked away
 * from. It is flash rate's denominator without being its numerator, and excluding it is exactly the
 * upward bias D14 exists to prevent.
 */
// Written out rather than generated from a generic helper: a conditional type over an unresolved
// type parameter stays deferred and resolves to `boolean`, so `AssertAssignable` could never see a
// literal `true`. Six explicit lines beat a helper that cannot fail.

export type FirstEncounterSent = AssertAssignable<
  IsAssignable<BaseOf & FrenchGrade & { is_send: true; prior_experience: 'none' }, Tick>
>; // derived: flash

export type FirstEncounterNotSent = AssertAssignable<
  IsAssignable<BaseOf & FrenchGrade & { is_send: false; prior_experience: 'none' }, Tick>
>; // the honest denominator

export type AttemptedSent = AssertAssignable<
  IsAssignable<BaseOf & FrenchGrade & { is_send: true; prior_experience: 'attempted' }, Tick>
>; // derived: redpoint

export type AttemptedNotSent = AssertAssignable<
  IsAssignable<BaseOf & FrenchGrade & { is_send: false; prior_experience: 'attempted' }, Tick>
>;

export type RepeatSent = AssertAssignable<
  IsAssignable<BaseOf & FrenchGrade & { is_send: true; prior_experience: 'sent' }, Tick>
>; // derived: redpoint

export type RepeatNotSent = AssertAssignable<
  IsAssignable<BaseOf & FrenchGrade & { is_send: false; prior_experience: 'sent' }, Tick>
>;

/** And the field itself is gone, not merely unused. */
export type NoSendStyleColumn = AssertNotAssignable<TickDeclaresKey<'send_style'>>;

/** Case is the only thing separating the two notations, so this is a different climb, not a typo. */
export type FrenchScaleWithFontLabelIsRejected = AssertNotAssignable<
  IsAssignable<
    BaseOf & { grade_scale: 'french'; grade_raw: '6A' } & {
      is_send: true;
      send_style: 'flash';
      prior_experience: 'none';
    },
    Tick
  >
>;

export type FontScaleWithFrenchLabelIsRejected = AssertNotAssignable<
  IsAssignable<
    BaseOf & { grade_scale: 'font'; grade_raw: '6a' } & {
      is_send: true;
      send_style: 'flash';
      prior_experience: 'none';
    },
    Tick
  >
>;

/** Not a grade on either scale. */
export type InventedGradeIsRejected = AssertNotAssignable<
  IsAssignable<
    BaseOf & { grade_scale: 'french'; grade_raw: '6d' } & {
      is_send: true;
      send_style: 'flash';
      prior_experience: 'none';
    },
    Tick
  >
>;

/**
 * No ordinal is stored — conversion is lossy and contested, so baking one at write time would make a
 * later correction rewrite history (§7.3, §8.4).
 *
 * Asserted as *absence of the key*, not as rejection of a row carrying one. Excess-property checking
 * only applies to fresh object literals, so a type with an extra field stays assignable to `Tick`;
 * an "is it rejected" assertion here would simply be false. What is genuinely true, and what this
 * checks, is that the row type declares no such field.
 */
type DeclaresKey<T, K extends string> = K extends keyof T ? true : false;

/**
 * Checked per union member, not against `keyof Tick`.
 *
 * **`keyof` a union yields only the keys common to every member**, so asking `keyof Tick` cannot see
 * a field added to just one of them — and adding a cached ordinal to only the Font member of
 * `TickGrade` is exactly how one would creep in. The original assertions used `keyof Tick` and would
 * have passed straight through that. Found by review.
 *
 * `MemberDeclaresKey` distributes over the union, so a key present on any single member surfaces as
 * `true` in the result; unioning the three constituents of `Tick` means a hit anywhere widens the
 * result to `boolean`, which does not satisfy `extends false`.
 */
type MemberDeclaresKey<U, K extends string> = U extends unknown
  ? K extends keyof U
    ? true
    : false
  : never;

type TickDeclaresKey<K extends string> =
  DeclaresKey<TickBase, K> | MemberDeclaresKey<TickGrade, K> | MemberDeclaresKey<TickOutcome, K>;

export type NoStoredOrdinal = AssertNotAssignable<TickDeclaresKey<'grade_index'>>;
export type NoStoredOrdinalAlias = AssertNotAssignable<TickDeclaresKey<'grade_ordinal'>>;

/** `is_repeat` is derived from `prior_experience = 'sent'`, never stored (D6). */
export type NoRepeatColumn = AssertNotAssignable<TickDeclaresKey<'is_repeat'>>;

/** Phase 1 and Phase 2 columns must be absent — a disposable single-device store needs none of
 *  them, and there is nothing to backfill (§7.7). */
export type NoUserId = AssertNotAssignable<TickDeclaresKey<'user_id'>>;
export type NoDeviceId = AssertNotAssignable<TickDeclaresKey<'device_id'>>;
export type NoSchemaVersion = AssertNotAssignable<TickDeclaresKey<'schema_version'>>;
export type NoVisibility = AssertNotAssignable<TickDeclaresKey<'visibility'>>;
export type NoProjectId = AssertNotAssignable<TickDeclaresKey<'project_id'>>;

/** There is no route entity — a tick is anonymous (§7.2, D2, D3). */
export type NoRouteId = AssertNotAssignable<TickDeclaresKey<'route_id'>>;

/** Columns dropped by D18, D19 and D21. Absence is asserted so a re-add is deliberate. */
export type NoAttempts = AssertNotAssignable<TickDeclaresKey<'attempts'>>;
export type NoVenueId = AssertNotAssignable<TickDeclaresKey<'venue_id'>>;
export type NoSector = AssertNotAssignable<TickDeclaresKey<'sector'>>;
export type NoHighPoint = AssertNotAssignable<TickDeclaresKey<'high_point'>>;
export type NoFreeTextTags = AssertNotAssignable<TickDeclaresKey<'tags'>>;

/**
 * Controls: the helper must actually report a key that *is* present, or every assertion above passes
 * vacuously for the trivial reason that it never returns `true`.
 *
 * Phrased as "is `true` among the results" rather than "is the result `true`", because a key on some
 * constituents and not others correctly yields `boolean` — `grade_raw` lives on the `TickGrade`
 * members but not on `TickBase`.
 */
type Reports<U, M> = M extends U ? true : false;

export type ControlDetectsAKeyOnAUnionMember = AssertAssignable<
  Reports<TickDeclaresKey<'grade_raw'>, true>
>;
export type ControlDetectsAKeyOnTheBase = AssertAssignable<
  Reports<TickDeclaresKey<'session_id'>, true>
>;
/** And must *not* report one that is genuinely absent, or the controls above prove nothing. */
export type ControlIgnoresAnAbsentKey = AssertNotAssignable<
  Reports<TickDeclaresKey<'not_a_field_anywhere'>, true>
>;

// ── Narrowing must work through the intersection ─────────────────────────────────────────────────

/**
 * The design's stated risk for the previous change: TypeScript does not eagerly distribute
 * `(A | B) & (C | D)`, so narrowing across an intersection of unions is the thing that works in toy
 * cases and degrades in real ones. It works, and it still has to.
 *
 * `TickOutcome` is no longer a union, so there is nothing left to narrow on `is_send` — which is why
 * the old `styleOf` is gone from here. Style now comes from `sendStyleOf` in `style.ts`, computed
 * rather than read. What remains to prove is that `TickGrade` and `TickDiscipline` still narrow
 * through the intersection.
 *
 * These are deliberately non-vacuous: each returns a type only the *narrowed* value satisfies, so a
 * regression is a compile error rather than a silent widening. An earlier pair returned the same
 * expression from both branches with a widened return type, compiled either way, and was cited as
 * evidence that narrowing worked. Found by review.
 */
export function fontRawOf(
  tick: Tick,
): Extract<TickGrade, { grade_scale: 'font' }>['grade_raw'] | null {
  return tick.grade_scale === 'font' ? tick.grade_raw : null;
}

/** Narrowing on the discipline union must survive the intersection too. */
export function boulderProtectionOf(tick: Tick): 'none' | null {
  return tick.discipline === 'boulder' ? tick.protection : null;
}

/** `is_repeat` is derived, never stored (D6). */
export function isRepeat(tick: Tick): boolean {
  return tick.prior_experience === 'sent';
}

/** `prior_experience` is readable without narrowing now that the outcome is a plain record. */
export function priorOf(outcome: TickOutcome): PriorExperience {
  return outcome.prior_experience;
}

// ── A venue must offer at least one discipline ───────────────────────────────────────────────────

/**
 * A missing scale means the venue does not offer that discipline — Tampereen Kiipeilykeskus Lielahti
 * is boulder-only and carries no rope scale. The corollary is that a venue with *neither* scale is a
 * gym nothing can be logged at, which is not a venue.
 */
interface VenueFields {
  id: string;
  type: 'indoor';
  name: string;
  city: string;
  country: string;
  pending_review: false;
}

export type BothScalesIsValid = AssertAssignable<
  IsAssignable<VenueFields & { default_scale_rope: 'french'; default_scale_boulder: 'font' }, Venue>
>;

export type RopeOnlyIsValid = AssertAssignable<
  IsAssignable<VenueFields & { default_scale_rope: 'french' }, Venue>
>;

/** Lielahti. */
export type BoulderOnlyIsValid = AssertAssignable<
  IsAssignable<VenueFields & { default_scale_boulder: 'french' }, Venue>
>;

export type VenueWithNoScalesIsRejected = AssertNotAssignable<IsAssignable<VenueFields, Venue>>;

/** The base carries no scales on its own, so the union is what supplies them. */
export type VenueBaseDeclaresNoScales = AssertNotAssignable<
  DeclaresKey<VenueBase, 'default_scale_rope'>
>;
