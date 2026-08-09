/**
 * Row shapes for the Phase 0 local database (`CONCEPT.md` §7.7).
 *
 * Invariants are enforced by construction rather than by a validator, because each fails *silently*
 * rather than loudly — nothing throws at the point of the mistake, so the point of the mistake has to
 * be a compile error:
 *
 * - **Grade and scale.** Font `6A` and French `6a` differ only by letter case. A mismatched pair is
 *   not a typo — it records a harder climb against a notation it was never graded with (§7.3, D5).
 * - **Discipline and protection.** `protection: 'none'` *means* boulder, so a boulder on lead lands in
 *   one group of the index while any consumer reading `protection === 'none'` drops it (§7.4).
 * - **A venue offers at least one discipline**, or nothing can be logged there.
 *
 * **The style invariant is gone, and that is a strengthening.** §7.4 named two invalid combinations of
 * `is_send`, `send_style` and `prior_experience`, and `CLAUDE.md` required the UI to make them
 * unreachable. D20 dropped `send_style` and derives it instead, so there is no longer a second field
 * that could contradict the first: the combinations are **unrepresentable** rather than merely
 * unreachable. A shorter `types.assert.ts` here means a stronger model, not a weaker one.
 */

import type { FontLabel, FrenchLabel, ScaleId } from '@tickd/grade-spec';

/** `YYYY-MM-DD` in the climber's local timezone. Lexicographic order is chronological order, which
 *  is what lets it index as a plain string. A climb belongs to the local day you climbed it. */
export type LocalDate = string;

/** Epoch milliseconds. Instants, as distinct from `LocalDate` — needed to order ticks within a
 *  session and to compute session duration (§7.7). */
export type Instant = number;

export type VenueType = 'indoor' | 'outdoor';

/** `trad` exists for outdoor completeness only and never appears in the indoor UI (§7.7). */
export type Discipline = 'boulder' | 'sport' | 'trad';

/** `none` means boulder — the absence of protection is what distinguishes it (§7.4). */
export type Protection = 'lead' | 'toprope' | 'autobelay' | 'none';

/** The protections that are a *choice*. Boulder's `none` is not one — it is what boulder means. */
export type RopedProtection = Exclude<Protection, 'none'>;

/**
 * There is deliberately no `SendStyle` here.
 *
 * A four-member `'onsight' | 'flash' | 'redpoint' | 'second_go'` survived D20's removal in this file
 * for a while, complete with a comment claiming `onsight` stayed "for outdoor use" — contradicting
 * both `style.ts` and `CLAUDE.md`'s "No onsight anywhere", and shadowing the live two-member
 * `SendStyle` that `style.ts` exports. Since this module holds every other tick type, it is the
 * import an author would reach for first, and they would have got the dead enum. Found by review.
 *
 * The style is derived, never stored: see `sendStyleOf` in `style.ts`.
 */

/** Experience *before this tick's first go*. `is_repeat` is derived from `'sent'` and is not a
 *  column (D6). */
export type PriorExperience = 'none' | 'attempted' | 'sent';

/** The climber's view of the setter's grade. */
export type GradeOpinion = 'soft' | 'fair' | 'hard';

/**
 * How good the climb was.
 *
 * Note what this cannot mean: with no route entity there is nothing to aggregate a rating *to*, so it
 * records "this go was good" rather than "this route is good" (§7.2, D2).
 */
export type Rating = 1 | 2 | 3 | 4 | 5;

/**
 * Wall angle and hold type — typed rather than free text (D21).
 *
 * Two fields rather than one list, because they answer independent questions: a route is not
 * overhanging *or* crimpy, it is both. Collapsing them would repeat D6's error at a smaller scale.
 *
 * Both vocabularies are deliberately short. A long list is an unfillable list, and an unfilled field
 * is what four other columns were dropped for.
 */
export type WallAngle = 'slab' | 'vertical' | 'overhang' | 'roof';
export type HoldType = 'crimp' | 'sloper' | 'pinch' | 'pocket' | 'jug';

/**
 * A location, never a brand. Kiipeilyareena's sites have different walls and wall heights, and wall
 * height drives the vertical-metres metric — so each site is its own row and `brand` only groups them
 * for display (§7.5).
 */
export interface VenueBase {
  readonly id: string;
  readonly type: VenueType;
  readonly name: string;
  readonly brand?: string;
  readonly city: string;
  readonly country: string;
  readonly geo?: { readonly lat: number; readonly lng: number };
  /** Wall height, per location. Absent until the real numbers are known (`CONCEPT.md` §12 Q1). */
  readonly default_route_length_m?: number;
  /** §7.5's "my gym isn't listed" path flags a user-created venue for later merging. Phase 1. */
  readonly pending_review: boolean;
  readonly canonical_id?: string;
}

/**
 * Which disciplines a venue offers, and in which notation.
 *
 * **A missing scale means the venue does not offer that discipline** — Tampereen Kiipeilykeskus
 * Lielahti is boulder-only, so it carries no rope scale at all. Presence is the encoding rather than
 * a separate `disciplines` list, which would duplicate the information and let the two disagree.
 *
 * The union makes "a venue offering nothing" unrepresentable. A row with neither scale would be a
 * gym you cannot log anything at, which is not a venue.
 *
 * A scale is still a notation, not a discipline (D17): these fields say *which notation this venue
 * grades that discipline in*, and the two need not differ. Tampere grades both in French.
 */
export type VenueScales =
  | { readonly default_scale_rope: ScaleId; readonly default_scale_boulder: ScaleId }
  | { readonly default_scale_rope: ScaleId; readonly default_scale_boulder?: never }
  | { readonly default_scale_rope?: never; readonly default_scale_boulder: ScaleId };

/**
 * A location, never a brand — and, since Lielahti exists, not necessarily a place with ropes.
 */
export type Venue = VenueBase & VenueScales;

export interface Session {
  readonly id: string;
  readonly venue_id: string;
  readonly date_local: LocalDate;
  readonly started_at: Instant;
  /**
   * Absent while the session is still open. §7.7 lists this without a `?`, but a session has to be
   * creatable before it is finished — every tap persists immediately, so ticks are written into a
   * session that has not ended yet.
   */
  readonly ended_at?: Instant;
}

/**
 * Grade and its notation, paired so they cannot disagree.
 *
 * The label unions come from `grade-spec`'s generated module, so `{ grade_scale: 'french',
 * grade_raw: '6A' }` is a compile error — `'6A'` is not a `FrenchLabel`.
 *
 * **No ordinal is stored.** Conversion is lossy and contested, so baking one at write time would make
 * a later correction rewrite history (§7.3, §8.4). Ordinals are derived at read time via
 * `grade-spec`'s `parseOrdinal`.
 */
export type TickGrade =
  | { readonly grade_scale: 'french'; readonly grade_raw: FrenchLabel }
  | { readonly grade_scale: 'font'; readonly grade_raw: FontLabel };

/**
 * How the go went.
 *
 * **Not a union, and no `send_style`.** A tick records one go (D20), so a send with no prior
 * experience *is* the first acquaintance and can only be a flash — the style is a function of these
 * two fields, and `sendStyleOf` computes it. Storing it would store something computable from its own
 * neighbours, which is exactly how a value becomes able to disagree with them.
 *
 * §7.4 named two invalid combinations and required the UI to make them unreachable. They are now
 * **unrepresentable**: all six pairings below are valid, and there is no third field left to
 * contradict either of these. That is strictly stronger than the union this replaced.
 *
 * `prior_experience` is read relative to *this go*. It cannot be defaulted — correct on the first go,
 * wrong on every go after — so the screen forces the choice (D20).
 */
export interface TickOutcome {
  readonly is_send: boolean;
  readonly prior_experience: PriorExperience;
}

/**
 * Everything about a tick that carries no invariant.
 *
 * There is deliberately no route reference and no route-identifying key. Indoor routes cannot be
 * identified — a newly set 6c+ in sector 4 is indistinguishable from the one it replaced (§7.2, D2,
 * D3). Nothing links the goes of one climb either: the session-scoped grouping that would was
 * designed and deferred (D21).
 */
export interface TickBase {
  readonly id: string;
  /** The only route to the venue: a tick carries none of its own (D19). */
  readonly session_id: string;
  readonly grade_opinion?: GradeOpinion;
  readonly rating?: Rating;
  readonly notes?: string;
  /** Overrides `venue.default_route_length_m` for this tick. */
  readonly length_m?: number;
  /** At most one — wall angle is roughly exclusive, and it is the characteristic that groups. */
  readonly angle?: WallAngle;
  /** Any number — a route can be crimpy and slopey at once (D21). */
  readonly holds?: readonly HoldType[];
  readonly date_local: LocalDate;
  /**
   * Minutes **east** of UTC — the ISO 8601 sign, so Helsinki in winter is `+120`.
   *
   * Stated explicitly because `Date.prototype.getTimezoneOffset()` returns the *opposite* sign. A
   * silent negation here misattributes ticks logged near midnight to the wrong local day.
   */
  readonly tz_offset: number;
  readonly created_at: Instant;
  readonly updated_at: Instant;
}

/**
 * Discipline and its protection, paired so they cannot contradict each other.
 *
 * `CONCEPT.md` §7.4 defines `protection: 'none'` as *meaning* boulder — the absence of protection is
 * what distinguishes it. Left as two independent fields, `{ discipline: 'boulder', protection:
 * 'lead' }` and `{ discipline: 'sport', protection: 'none' }` were both representable, and a
 * logging-screen bug that moved the discipline toggle while leaving `protection` behind would write
 * one.
 *
 * Such a row is worse than an error because it is counted inconsistently rather than rejected: it
 * lands in the boulder group of the `[discipline+grade_scale]` index, while any consumer that follows
 * §7.4 and reads `protection === 'none'` as "is a boulder" drops it. Two plausible, mutually
 * contradictory numbers — the same failure mode the style union exists to prevent.
 *
 * `trad` is here for outdoor completeness only and never appears in the indoor UI (§7.7).
 */
export type TickDiscipline =
  | { readonly discipline: 'boulder'; readonly protection: 'none' }
  | {
      readonly discipline: 'sport' | 'trad';
      readonly protection: 'lead' | 'toprope' | 'autobelay';
    };

/** A tick: anonymous, graded in exactly one notation, with style and discipline combinations that
 *  are valid by construction. */
export type Tick = TickBase & TickGrade & TickOutcome & TickDiscipline;
