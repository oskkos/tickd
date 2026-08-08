/**
 * Row shapes for the Phase 0 local database (`CONCEPT.md` §7.7).
 *
 * Two invariants are enforced here by construction rather than by a validator, because both fail
 * *silently* rather than loudly:
 *
 * - **The style fields.** A tick with `is_send: false` carrying `send_style: 'flash'` does not throw
 *   when written; it inflates the flash-rate numerator permanently. Flash rate divides by first
 *   encounters precisely so it stays honest at the limit grade (§4.2, D14), and this is the one way
 *   to corrupt it without an error.
 * - **Grade and scale.** Font `6A` and French `6a` differ only by letter case. A mismatched pair is
 *   not a typo — it records a harder climb against a notation it was never graded with (§7.3, D5).
 *
 * `CLAUDE.md` requires the UI to make the invalid combinations unreachable. A UI can only make
 * unreachable what the model has already ruled out, which is why this file exists before the logging
 * screen rather than beside it. `types.assert.ts` proves the guards still bite.
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

/** `onsight` stays in the model for outdoor use; there is no onsight option in the indoor UI (§6). */
export type SendStyle = 'onsight' | 'flash' | 'redpoint' | 'second_go';

/** Experience *before this tick's first go*. `is_repeat` is derived from `'sent'` and is not a
 *  column (D6). */
export type PriorExperience = 'none' | 'attempted' | 'sent';

/**
 * Provisional fields.
 *
 * `CONCEPT.md` §7.7 lists these for Phase 0 but does not define their semantics, and no Phase 0 UI
 * writes them yet. The types below are the most conservative reading rather than a settled decision —
 * refine them when the logging screen actually defines what they mean.
 */
export type GradeOpinion = 'soft' | 'fair' | 'hard';
export type Rating = 1 | 2 | 3 | 4 | 5;

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
  readonly conditions?: string;
  readonly felt?: string;
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
 * The two invalid style combinations from §7.4, made unrepresentable.
 *
 * Member 1 — an attempt cannot carry a send style. Because the repo sets
 * `exactOptionalPropertyTypes`, `send_style?: never` also rejects an explicit `send_style: undefined`,
 * so the field must be genuinely absent rather than present-and-empty.
 *
 * Member 2 — `flash` and `onsight` mean *no prior experience*, so they pin `prior_experience`.
 *
 * Member 3 — `redpoint` and `second_go` accept **any** prior experience, `'none'` included. That is
 * deliberate: working a climb across several goes within one session leaves the experience *before
 * the first go* at none. Constraining it would forbid a real and common tick.
 */
export type TickOutcome =
  | {
      readonly is_send: false;
      readonly send_style?: never;
      readonly prior_experience: PriorExperience;
    }
  | {
      readonly is_send: true;
      readonly send_style: 'onsight' | 'flash';
      readonly prior_experience: 'none';
    }
  | {
      readonly is_send: true;
      readonly send_style: 'redpoint' | 'second_go';
      readonly prior_experience: PriorExperience;
    };

/**
 * Everything about a tick that carries no invariant.
 *
 * There is deliberately no route reference and no route-identifying key. Indoor routes cannot be
 * identified — a newly set 6c+ in sector 4 is indistinguishable from the one it replaced — so a tick
 * is anonymous and `sector` is free text rather than an entity (§7.2, D2, D3).
 */
export interface TickBase {
  readonly id: string;
  readonly session_id: string;
  readonly venue_id: string;
  /** Free text, autocompleted from previous ticks. Never an entity. */
  readonly sector?: string;
  readonly attempts?: number;
  readonly high_point?: string;
  readonly grade_opinion?: GradeOpinion;
  readonly rating?: Rating;
  readonly notes?: string;
  /** Overrides `venue.default_route_length_m` for this tick. */
  readonly length_m?: number;
  readonly tags: readonly string[];
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
