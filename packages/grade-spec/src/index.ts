/**
 * Grade scales for tickd.
 *
 * The one thing this module exists to make impossible: comparing a Font ordinal with a French one.
 * Font `6A` and French `6a` differ only by letter case and mean very different difficulties, so
 * mixing them ranks incomparable values against each other and silently corrupts every metric
 * (`CONCEPT.md` §7.3, D5).
 *
 * That is a *notation* guarantee, not a discipline one. A scale does not imply a discipline — French
 * serves boulders at some venues — so keeping boulders and routes apart is the consuming layer's job,
 * via the `discipline` and `protection` fields on a tick (`CONCEPT.md` §4.2, D17).
 *
 * Separation is structural rather than asserted. See `Ordinal` and `compare` below.
 */

import {
  LABELS_BY_SCALE,
  SCALE_IDS,
  SPEC_VERSION,
  type FontLabel,
  type FrenchLabel,
  type ScaleId,
} from './generated/scales.ts';

export { SPEC_VERSION, SCALE_IDS, type ScaleId, type FontLabel, type FrenchLabel };

/** The labels of a given scale, as a literal union. */
export type LabelOf<S extends ScaleId> = (typeof LABELS_BY_SCALE)[S][number];

/**
 * A position within one scale.
 *
 * `scale` is the brand. Because it holds a literal type, `Ordinal<'french'>` and `Ordinal<'font'>`
 * are already incompatible under structural typing — no phantom property needed, and unlike a
 * phantom the value is real and useful when logging or serialising.
 *
 * `kind` is the tag. Phase 0 constructs only `'exact'`; indoor gyms always tag a single grade
 * (`CONCEPT.md` §7.3). When open grades arrive, a `{ kind: 'range' }` variant is added here and every
 * consumer that must handle it stops compiling — which is the point of paying for a union now.
 */
export interface ExactOrdinal<S extends ScaleId = ScaleId> {
  readonly scale: S;
  readonly kind: 'exact';
  readonly index: number;
}

/**
 * Already a union, of one member. When open grades arrive this becomes
 * `ExactOrdinal<S> | RangeOrdinal<S>` — a one-line change here, and a compile error in every consumer
 * that assumed there was only ever one variant.
 */
export type Ordinal<S extends ScaleId = ScaleId> = ExactOrdinal<S>;

/** All labels of a scale, easiest first. Presentation order is the caller's business. */
export function labels<S extends ScaleId>(scale: S): readonly LabelOf<S>[] {
  return LABELS_BY_SCALE[scale];
}

/**
 * Whether `raw` is a label of `scale`, compared exactly.
 *
 * Nothing is trimmed, lowercased or uppercased. Case is the only thing distinguishing a Font label
 * from a French one, so normalising here would move a grade onto the other scale rather than
 * rejecting it (`DESIGN.md` §2 forbids the same thing in CSS).
 *
 * Note that a scale does not imply a discipline — French serves boulders at some venues
 * (`CONCEPT.md` D17). Case identifies the scale, nothing more.
 */
export function isLabel<S extends ScaleId>(raw: unknown, scale: S): raw is LabelOf<S> {
  return typeof raw === 'string' && (labels(scale) as readonly string[]).includes(raw);
}

/** The ordinal for a known label. */
export function ordinalOf<S extends ScaleId>(label: LabelOf<S>, scale: S): Ordinal<S> {
  const index = (labels(scale) as readonly string[]).indexOf(label);
  if (index === -1) {
    throw new RangeError(`"${label}" is not a ${scale} grade`);
  }
  return { scale, kind: 'exact', index };
}

/**
 * The ordinal for a `(grade_raw, grade_scale)` pair from untrusted input, or `undefined`.
 *
 * This is the importer's entry point — Phase 0's only untrusted input path (`CONCEPT.md` §7.6).
 */
export function parseOrdinal<S extends ScaleId>(raw: unknown, scale: S): Ordinal<S> | undefined {
  // One scan. `isLabel` then `ordinalOf` would walk the label list twice for the same answer, and
  // this runs once per tick when analytics read `grade_raw` back out of Dexie.
  if (typeof raw !== 'string') {
    return undefined;
  }
  const index = (labels(scale) as readonly string[]).indexOf(raw);
  return index === -1 ? undefined : { scale, kind: 'exact', index };
}

/** The label for an ordinal, verbatim. */
export function labelOf<S extends ScaleId>(ordinal: Ordinal<S>): LabelOf<S> {
  const label = labels(ordinal.scale)[ordinal.index];
  if (label === undefined) {
    throw new RangeError(`index ${String(ordinal.index)} is outside the ${ordinal.scale} scale`);
  }
  return label;
}

/**
 * Negative if `a` is easier than `b`, positive if harder, zero if equal.
 *
 * `NoInfer` on the second parameter is load-bearing, not decoration. Without it TypeScript infers
 * `S = 'french' | 'font'` from the two arguments together and accepts `compare(french6a, font6A)` —
 * the signature would read as if it enforced the invariant while enforcing nothing. Do not remove
 * it; `types.assert.ts` fails if it goes.
 */
export function compare<S extends ScaleId>(a: Ordinal<S>, b: NoInfer<Ordinal<S>>): number {
  return a.index - b.index;
}

/** Whether two ordinals of the same scale denote the same grade. */
export function equals<S extends ScaleId>(a: Ordinal<S>, b: NoInfer<Ordinal<S>>): boolean {
  return compare(a, b) === 0;
}

/**
 * A contiguous span of labels, clamped to the scale's bounds.
 *
 * This is what the grade grid's default working range is built from: `[min − 2 … max + 2]` of recent
 * ticks, clamped so the ends of the scale stay reachable without producing out-of-range indices
 * (`DESIGN.md` §5).
 */
export function clampRange<S extends ScaleId>(
  from: number,
  to: number,
  scale: S,
): readonly LabelOf<S>[] {
  const all = labels(scale);
  const lo = Math.max(0, Math.min(from, to));
  const hi = Math.min(all.length - 1, Math.max(from, to));
  return hi < lo ? [] : all.slice(lo, hi + 1);
}

/** The hardest index in a scale. */
export function maxIndex(scale: ScaleId): number {
  return labels(scale).length - 1;
}
