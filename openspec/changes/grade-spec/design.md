## Context

`packages/grade-spec` is an empty workspace member with a README explaining what it will hold. The
scales were settled immediately before this change: French 27 values, Font 23, explicit lists, always a
single grade indoors, `venue` carrying per-discipline default scales.

The hard part is not the data — it is 50 labels — but the fact that this package is where the
project's most dangerous invariant lives. Font `6A` and French `6a` differ only by letter case. Every
downstream metric is corrupted if they ever share an ordinal namespace, and the corruption is silent:
a pyramid with boulders folded into it looks like a pyramid.

`CONCEPT.md` §8.4 frames this package as a *conversion* spec generated to Kotlin and TypeScript. Phase
0 needs neither conversion nor Kotlin, so most of this design is about building the small correct
thing without the machinery that framing implies.

## Goals / Non-Goals

**Goals:**

- Two scales as explicit, commented, versioned data.
- Cross-scale comparison that fails to compile, not one that fails a test.
- An ordinal shape that can grow an open-grade variant without a silent widening.
- Case-sensitive validation, ready for the importer.
- Index arithmetic the grid can use for `[min − 2 … max + 2]`.
- Generated output committed, with drift detected.

**Non-Goals:**

- Cross-scale conversion of any kind. No V-scale, YDS, UIAA, Scandinavian or Finnish.
- A Kotlin emitter.
- Constructing open-grade or unknown-grade ordinals.
- The grade grid, any React component, any Dexie schema, or wiring the package into `apps/web` — there
  is no consumer yet, and the package earns its own tests standalone.

## Decisions

**The `scale` field is the brand.** Rather than a phantom `__brand` property, an ordinal carries its
scale as real runtime data:

```ts
type Ordinal<S extends ScaleId> = { readonly scale: S; readonly kind: 'exact'; readonly index: number }
```

`Ordinal<'french'>` and `Ordinal<'font'>` are already incompatible under structural typing because the
literal types differ, so separation costs nothing extra — and unlike a phantom brand, the value is
genuinely useful when logging, serialising or debugging. This also satisfies the discriminated-union
requirement in the same shape, since `kind` is the tag a future `range` variant would extend.

**Generic inference can defeat this, so pin it.** A naive `compare<S extends ScaleId>(a: Ordinal<S>, b:
Ordinal<S>)` will infer `S = 'french' | 'font'` when given one of each and happily accept the call.
The fix is to stop inference from the second parameter:

```ts
function compare<S extends ScaleId>(a: Ordinal<S>, b: NoInfer<Ordinal<S>>): number
```

This is the single subtlety that decides whether the invariant is actually enforced, which is why the
spec asks for a compile-failure scenario rather than trusting the signature to read correctly.

**Type-level assertions use `@ts-expect-error`, not a new dependency.** A file of deliberate
mis-calls annotated with `@ts-expect-error` fails `tsc --noEmit` if the error stops occurring — which
is exactly the regression to catch. `tsd` and `expect-type` would do the same with more moving parts.
`just typecheck` therefore verifies the invariant; no test runner involved.

**The generator emits data, not logic.** The generated module exports the label tuples, the literal
label types derived from them, and the spec version. Every function is hand-written in the same
package. Generated code should be dumb enough that reviewing a diff is trivial, and logic deserves
tests rather than a template.

**Labels are emitted `as const`,** so `type FrenchLabel = '4' | '4+' | …` falls out of the data. That
makes validation a type guard that narrows, rather than a boolean the caller must remember to trust.
Fifty literals is nothing.

**All YAML labels must be quoted, and the generator must enforce it.** `4` and `5` parse as integers
while `4+` and `6a` parse as strings, so an unquoted list yields mixed types and a generated tuple
containing numbers. The generator SHALL reject a spec containing any non-string label rather than
coercing — a coerced `4` is indistinguishable from a correct one until something compares it to a
label.

**The generated module has zero runtime dependencies.** The YAML parser is a devDependency of
`packages/grade-spec` only, used at generation time, so nothing about YAML reaches the web bundle.

**Drift is checked without mutating the tree.** The check regenerates to memory and diffs against the
committed file, rather than regenerating in place and relying on `git diff --exit-code`. The latter is
shorter but conflates "spec drifted" with "you have uncommitted work", and fails confusingly on a
dirty checkout.

**The generator runs on Node directly.** Node 24 strips TypeScript types natively, so the generator can
be a `.ts` file with no `tsx` or build step of its own.

**Indices are 0-based** and correspond to array position. No offsetting between scales — disjoint
integer ranges were considered and rejected: they make accidental mixing *detectable* in raw data but
also make wrong answers look plausible, and they smuggle encoding into values that invite arithmetic.
Type separation is the stronger guarantee, so the numbers stay honest.

## Risks / Trade-offs

- **A stale committed module ships wrong labels** → the drift check in `just check`, plus determinism
  so it cannot fail spuriously and get ignored.
- **`NoInfer` is subtle enough to be removed by a well-meaning cleanup** → the `@ts-expect-error`
  assertions fail immediately if it goes, and the reason is commented at the signature.
- **The structural cross-check between scales could enshrine a shared typo** → it compares the two
  lists to each other, so a typo in one is caught; a *matching* typo in both, at the same index, in
  the same position, would survive. The explicit counts (27 and 23) and the ordering assertions are
  the second net.
- **Deviating from §8.4 by not emitting Kotlin** → the YAML remains the single contract, so Phase 1
  adds an emitter rather than reconciling two hand-maintained tables. Recorded in the proposal so it
  is a decision rather than an omission.
- **`packages/grade-spec` gaining a `codegen` target loosens the build-tooling fence** → the delta spec
  narrows the exclusion to Phase 1's Flyway → jOOQ → OpenAPI chain, which is what actually needs
  infrastructure, rather than to the word "codegen".

## Migration Plan

Nothing consumes the package yet, so there is nothing to migrate and no rollback beyond reverting the
commit. The generated module and the YAML land together; a commit where they disagree is what the drift
check exists to prevent.

## Open Questions

- **Does the YAML record which family a scale belongs to** (rope vs boulder)? It is useful metadata for
  grouping in a UI, but the authority for *which scale a screen defaults to* is
  `venue.default_scale_rope` / `default_scale_boulder` (`CONCEPT.md` §7.7). Including it risks a second
  source of truth for the same question; omitting it means a consumer must know the pairing.
- **Where does the label list's presentation order live?** `DESIGN.md` §5 leaves grid direction —
  easiest at the bottom versus the top — deliberately open. The spec stores easiest-first as the
  canonical order; whether the grid reverses it is a UI decision, and this package should not encode
  it.
- **Does the package export a single entry point or subpaths?** One entry is simpler and 50 labels is
  small; subpaths would matter only if a consumer wanted labels without the logic.
