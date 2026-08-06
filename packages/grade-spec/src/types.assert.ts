/**
 * Type-level assertions. There is nothing to run — `tsc --noEmit` is the test.
 *
 * Each `@ts-expect-error` below fails typechecking if the error it expects stops occurring. That is
 * the regression worth catching: the namespace separation in `index.ts` is enforced by the type
 * system, and a well-meaning simplification could silently disable it while every runtime test keeps
 * passing.
 *
 * This file is inside the package's tsconfig `include`, so `just typecheck` evaluates it.
 */

import { compare, equals, labelOf, ordinalOf, type Ordinal } from './index.ts';

const rope = ordinalOf('6a', 'french');
const boulder = ordinalOf('6A', 'font');

// Same scale — these must keep compiling.
compare(rope, ordinalOf('7a', 'french'));
compare(boulder, ordinalOf('7A', 'font'));
equals(rope, ordinalOf('6a', 'french'));

// ── The invariant ───────────────────────────────────────────────────────────────
// Cross-scale comparison must not compile. If `NoInfer` is removed from `compare`, TypeScript infers
// S as `'french' | 'font'` and accepts these calls — at which point these lines stop erroring and
// this file fails to typecheck, which is exactly the alarm.

// @ts-expect-error Font and French ordinals cannot be compared.
compare(rope, boulder);

// @ts-expect-error Font and French ordinals cannot be compared.
compare(boulder, rope);

// @ts-expect-error Font and French ordinals cannot be tested for equality.
equals(rope, boulder);

// ── A label belongs to exactly one scale ───────────────────────────────────────

// @ts-expect-error '6A' is a Font label, not a French one.
ordinalOf('6A', 'french');

// @ts-expect-error '6a' is a French label, not a Font one.
ordinalOf('6a', 'font');

// @ts-expect-error '6d' is not a grade in any scale.
ordinalOf('6d', 'french');

// @ts-expect-error '9c' has no Font equivalent.
ordinalOf('9c', 'font');

// ── An ordinal is not a bare number ────────────────────────────────────────────
// This is what keeps a future `{ kind: 'range' }` variant from widening silently: consumers must
// narrow on the tag rather than treating an ordinal as arithmetic.

// @ts-expect-error An ordinal is a tagged object, not a number.
const arithmetic: number = rope;

// @ts-expect-error A number is not an ordinal.
labelOf(4);

// @ts-expect-error 'range' is not a constructible variant in Phase 0.
const openGrade: Ordinal<'font'> = { scale: 'font', kind: 'range', lo: 4, hi: 5 };

// @ts-expect-error The scale field is the brand and cannot be reassigned across scales.
const mislabelled: Ordinal<'french'> = boulder;

export type { arithmetic, openGrade, mislabelled };
