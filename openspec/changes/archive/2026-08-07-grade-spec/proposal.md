## Why

`packages/grade-spec` exists as an empty workspace member. Everything downstream in Phase 0 needs it:
the grade grid renders its label sets, the grid's default working range is index arithmetic over it,
and the JSON importer — Phase 0's only untrusted input path — has nothing to validate `grade_raw`
against without it. `CONCEPT.md` §13 names it as the next step for exactly this reason.

It is also where the invariant most capable of silently corrupting data lives. Font `6A` and French
`6a` differ only by letter case and mean very different difficulties (§7.3, D5). If those two ever
share an ordinal namespace, boulders and routes land on one pyramid and every metric is quietly wrong.
Getting that structurally right is cheap now and expensive later.

The scales themselves were just settled: French 27 values, Font 23, explicit lists, always a single
grade indoors.

## What Changes

- **A versioned YAML spec** in `packages/grade-spec` enumerating both scales as explicit ordered
  lists. Not generated from a `number × letter × modifier` pattern — that would happily emit `6d`,
  `9c+` and `5A`.
- **A generator emitting a TypeScript module** from that YAML, with the output committed so
  typechecking the web app needs no codegen step, and a drift check that fails when the committed
  output disagrees with the spec.
- **An ordinal representation that makes cross-scale comparison a compile error**, not a convention
  backed by a unit test. Scale-branded types, and an ordinal that is a discriminated union
  (`{ kind: 'exact', index }`) from the first commit so a future `range` variant cannot widen
  silently.
- **A small API surface**: labels for a scale, label → index, index → label, index arithmetic for the
  grid's `[min − 2 … max + 2]` default range, and case-sensitive validation of a `(grade_raw,
  grade_scale)` pair.
- **Tests that check the structure rather than restating the lists**: the two scales' first 22 entries
  are identical but for letter case, which catches a typo in either list; plus round-trip
  label↔index, validation rejecting wrong-case and unknown values, and type-level assertions that
  mixing scales does not compile.
- **`just` gains a codegen target**, and `just check` gains the drift check.

Explicitly **not** in this change:

- **Cross-scale conversion.** V-scale, YDS, UIAA, Scandinavian and Finnish are all deferred (D1, D5),
  and Phase 0's one analytic groups within a discipline, so nothing crosses scales. The versioning
  machinery §8.4 describes exists to make a *contested conversion* correctable; there are no
  conversions yet. The spec carries a version field regardless — it is one line and sets the habit.
- **The Kotlin emitter.** Phase 0 has no Kotlin build, so emitting Kotlin produces a file nothing
  compiles or tests. The YAML is the contract; adding an emitter later is additive. A deliberate
  deviation from §8.4's letter, consistent with `backend/` staying empty.
- **Open-grade ranges and unknown grades.** Represented in the type's shape, never constructed (§7.3).
- **The grade grid**, any UI, and any Dexie schema. Separate changes.

## Capabilities

### New Capabilities

- `grade-scales`: the scale definitions, ordinal representation and namespace separation, validation
  of a grade against a scale, and the codegen contract between the YAML spec and its generated
  consumers.

### Modified Capabilities

- `build-tooling`: two requirements change. `packages/grade-spec` is no longer an empty workspace
  member, and the justfile gains a codegen target plus a drift check — which the existing "only
  targets Phase 0 can run" requirement has to accommodate.

## Impact

- **New**: `packages/grade-spec/` — the YAML spec, the generator, the committed generated module, and
  its tests.
- **Modified**: `justfile` (codegen and drift targets), root `package.json` if the drift check needs a
  script, `openspec/specs/build-tooling/spec.md` via the delta.
- **Downstream, not in this change**: the grade grid consumes the label sets and index arithmetic; the
  importer consumes validation; `venue.default_scale_rope` / `default_scale_boulder` (`CONCEPT.md`
  §7.7) select which scale a screen defaults to.
- **Risk**: the generated module is committed, so a stale commit is possible. The drift check in
  `just check` is the mitigation, and it must run in CI once CI exists.
