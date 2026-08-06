## 1. The spec file

- [x] 1.1 Add `packages/grade-spec/scales.yaml` with a `version` field and both scales as explicit
      ordered label lists, easiest first
- [x] 1.2 Quote every label so `4` and `5` do not parse as integers, and comment the deliberate
      absences (`6d`, `9c+`, no Font values above `9A`)
- [x] 1.3 Confirm the lists match `CONCEPT.md` §7.3 exactly — 27 French, 23 Font

## 2. The generator

- [x] 2.1 Add `yaml` as a devDependency of `packages/grade-spec` only, so nothing reaches the web bundle
- [x] 2.2 Write the generator as a `.ts` file run directly by Node 24's type stripping — no `tsx`, no
      build step
- [x] 2.3 Reject a spec containing any non-string label, rather than coercing it
- [x] 2.4 Reject a spec whose label count disagrees with a declared count, so a dropped line cannot pass
      silently
- [x] 2.5 Emit data only — label tuples `as const`, the derived literal label types, and the spec
      version. No functions
- [x] 2.6 Make output deterministic and stable in formatting, so the drift check cannot fail spuriously

## 3. The hand-written API

- [ ] 3.1 Define `Ordinal<S>` as `{ scale: S; kind: 'exact'; index: number }` — the scale field is the
      brand, `kind` is the tag a future `range` variant extends
- [ ] 3.2 `ordinalOf(label, scale)` returning a typed ordinal, and `labelOf(ordinal)` returning the
      label verbatim
- [ ] 3.3 `compare(a, b)` with `NoInfer` on the second parameter, and a comment at the signature saying
      why removing it silently breaks the invariant
- [ ] 3.4 `isLabel(raw, scale)` as a type guard — exact comparison, no trimming, no case folding
- [ ] 3.5 `clampRange(from, to, scale)` for the grid's `[min − 2 … max + 2]`, clamped to scale bounds
- [ ] 3.6 Export no function that converts between scales

## 4. Tests

- [ ] 4.1 Round-trip every label in both scales through `ordinalOf` → `labelOf` and assert exact
      equality including case
- [ ] 4.2 Assert the counts (27 and 23) and that each label is strictly harder than its predecessor
- [ ] 4.3 Structural cross-check: indices 0–21 of the two scales are equal case-insensitively, and
      above 21 French has five labels to Font's one
- [ ] 4.4 Assert `6d`, `9c+`, `5A`, `V4`, `""` and a trailing-space label all fail validation
- [ ] 4.5 Assert `("6A", "french")` and `("6a", "font")` are rejected rather than corrected
- [ ] 4.6 Assert `clampRange` clamps at both ends without producing out-of-bounds indices
- [ ] 4.7 Type-level assertions in a `@ts-expect-error` file: cross-scale `compare` does not compile,
      and an ordinal is not usable as a bare number
- [ ] 4.8 Confirm the type-level file is inside the package's tsconfig, so `just typecheck` actually
      evaluates it

## 5. Wiring

- [ ] 5.1 Add `typecheck`, `lint` and `test` scripts to `packages/grade-spec` so `pnpm -r` picks it up
- [ ] 5.2 Add a `codegen` recipe to the justfile
- [ ] 5.3 Add a non-mutating drift check that regenerates in memory and diffs against the committed file
- [ ] 5.4 Add the drift check to `just check`
- [ ] 5.5 Commit the generated module

## 6. Verify

- [ ] 6.1 `just check` passes from a clean install with no codegen step run first
- [ ] 6.2 Edit the YAML without regenerating and confirm the drift check fails
- [ ] 6.3 Run the generator twice and confirm byte-identical output
- [ ] 6.4 Temporarily remove `NoInfer` and confirm the type-level assertions fail, then restore it
- [ ] 6.5 Confirm `apps/web` still builds and typechecks without depending on the package yet
- [ ] 6.6 Re-read the `build-tooling` delta against the finished tree and confirm no Phase 1 tooling
      arrived alongside
