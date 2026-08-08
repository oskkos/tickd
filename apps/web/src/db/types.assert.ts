/**
 * Type-level assertions for the tick invariants. `tsc --noEmit` is the test.
 *
 * Same purpose as `packages/grade-spec/src/types.assert.ts` — if someone widens `TickOutcome` or
 * `TickGrade` so an invalid combination becomes representable, this file fails the build rather than
 * letting it pass silently. The mechanism differs from `grade-spec`'s: see the note above
 * `AssertNotAssignable` for why `@ts-expect-error` does not work for these particular shapes.
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
  venue_id: 'c',
  // Discipline and protection are one unit: `protection: 'none'` means boulder (§7.4).
  discipline: 'sport',
  protection: 'lead',
  tags: [],
  date_local: '2026-08-07',
  tz_offset: 180,
  created_at: 0,
  updated_at: 0,
} as const;

// ── Valid combinations must compile ──────────────────────────────────────────────────────────────

export const flashOnFirstEncounter: Tick = {
  ...base,
  grade_scale: 'french',
  grade_raw: '6a',
  is_send: true,
  send_style: 'flash',
  prior_experience: 'none',
};

export const attemptWithNoStyle: Tick = {
  ...base,
  grade_scale: 'french',
  grade_raw: '7a',
  is_send: false,
  prior_experience: 'attempted',
};

export const fontBoulder: Tick = {
  ...base,
  discipline: 'boulder',
  protection: 'none',
  grade_scale: 'font',
  grade_raw: '6A',
  is_send: true,
  send_style: 'redpoint',
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
  send_style: 'flash',
  prior_experience: 'none',
};

/**
 * Worked sends accept *any* prior experience, `'none'` included — several goes within one session
 * leave the experience before the first go at none. If this ever stops compiling, member 3 of
 * `TickOutcome` has been over-constrained.
 */
export const secondGoWithoutPriorExperience: Tick = {
  ...base,
  grade_scale: 'french',
  grade_raw: '6b',
  is_send: true,
  send_style: 'second_go',
  prior_experience: 'none',
};

export const redpointWithoutPriorExperience: Tick = {
  ...base,
  grade_scale: 'french',
  grade_raw: '6b',
  is_send: true,
  send_style: 'redpoint',
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
  IsAssignable<
    BaseOf & FrenchGrade & { is_send: true; send_style: 'flash'; prior_experience: 'none' },
    Tick
  >
>;

/** The same control on the other notation, so a regression cannot hide on one scale. */
export type ControlValidFontTickIsAssignable = AssertAssignable<
  IsAssignable<BaseOf & FontGrade & { is_send: false; prior_experience: 'attempted' }, Tick>
>;

/** An attempt cannot carry a send style — the corruption that silently inflates flash rate. */
export type AttemptWithSendStyleIsRejected = AssertNotAssignable<
  IsAssignable<
    BaseOf & FrenchGrade & { is_send: false; send_style: 'flash'; prior_experience: 'none' },
    Tick
  >
>;

/** Absent, not present-and-empty. This is what `exactOptionalPropertyTypes` buys. */
export type AttemptWithUndefinedSendStyleIsRejected = AssertNotAssignable<
  IsAssignable<
    BaseOf & FrenchGrade & { is_send: false; send_style: undefined; prior_experience: 'none' },
    Tick
  >
>;

/** A flash means no prior experience, by definition. */
export type FlashAfterAttemptingIsRejected = AssertNotAssignable<
  IsAssignable<
    BaseOf & FrenchGrade & { is_send: true; send_style: 'flash'; prior_experience: 'attempted' },
    Tick
  >
>;

export type OnsightAfterSendingIsRejected = AssertNotAssignable<
  IsAssignable<
    BaseOf & FrenchGrade & { is_send: true; send_style: 'onsight'; prior_experience: 'sent' },
    Tick
  >
>;

/** A send must say how. */
export type SendWithoutStyleIsRejected = AssertNotAssignable<
  IsAssignable<BaseOf & FrenchGrade & { is_send: true; prior_experience: 'none' }, Tick>
>;

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
 * The design's stated risk: TypeScript does not eagerly distribute `(A | B) & (C | D)`, so narrowing
 * across an intersection of two discriminated unions is exactly the thing that works in toy cases and
 * degrades in real ones. If these stop compiling, the fallback is an explicit six-member union.
 */
export function styleOf(tick: Tick): SendStyleOrNull {
  if (tick.is_send) {
    // Narrowed to members 2|3, so `send_style` is present without a non-null assertion.
    return tick.send_style;
  }
  return null;
}
type SendStyleOrNull = 'onsight' | 'flash' | 'redpoint' | 'second_go' | null;

/**
 * Narrowing on the *other* union must survive the intersection too.
 *
 * The previous version of this — `tick.grade_scale === 'font' ? tick.grade_raw : tick.grade_raw`
 * returning `string` — was **vacuous**: both branches were the same expression and `string` accepts
 * the un-narrowed union, so it compiled whether or not narrowing worked. It was cited as evidence
 * that the six-member-union fallback was unnecessary. Found by review.
 *
 * The return type here is the Font label union specifically, so a widened `string` does not satisfy
 * it and a narrowing regression is a compile error. `writes.assert.ts` carries the French twin.
 */
export function fontRawOf(
  tick: Tick,
): Extract<TickGrade, { grade_scale: 'font' }>['grade_raw'] | null {
  return tick.grade_scale === 'font' ? tick.grade_raw : null;
}

/** `is_repeat` is derived, never stored (D6). */
export function isRepeat(tick: Tick): boolean {
  return tick.prior_experience === 'sent';
}

/**
 * Narrowing the standalone outcome union, independent of the intersection.
 *
 * Also previously vacuous — both branches returned the same expression and `PriorExperience` accepts
 * the un-narrowed value. This version returns the *narrowed* literal type on the flash branch, which
 * only compiles because member 2 of `TickOutcome` pins `prior_experience` to `'none'`.
 */
export function priorOf(outcome: TickOutcome): PriorExperience {
  return outcome.prior_experience;
}

/** A flash is a first encounter by definition, and narrowing must prove it without an assertion. */
export function priorOfFlash(outcome: TickOutcome): 'none' | null {
  if (outcome.is_send && (outcome.send_style === 'flash' || outcome.send_style === 'onsight')) {
    return outcome.prior_experience;
  }
  return null;
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
