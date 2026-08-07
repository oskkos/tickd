## ADDED Requirements

### Requirement: Scales are enumerated, not generated

Each supported scale SHALL be defined as an explicit ordered list of labels in a single versioned YAML
spec. Labels SHALL NOT be derived from a pattern over numbers, letters and modifiers, because no such
pattern describes either scale without per-number exceptions.

French SHALL have 27 values and Fontainebleau 23, as enumerated in `CONCEPT.md` §7.3.

#### Scenario: French scale is complete and ordered

- **WHEN** the French label list is read
- **THEN** it contains exactly 27 labels, beginning `4`, `4+`, `5`, `5+`, `6a` and ending `9b+`, `9c`
- **AND** every label is strictly harder than the one before it

#### Scenario: Fontainebleau scale is complete and ordered

- **WHEN** the Font label list is read
- **THEN** it contains exactly 23 labels, beginning `4`, `4+`, `5`, `5+`, `6A` and ending `8C+`, `9A`

#### Scenario: Invented labels are absent

- **WHEN** either list is searched for `6d`, `9c+`, `5A` or `6a+ ` (trailing space)
- **THEN** none is present

### Requirement: The spec is versioned

The YAML spec SHALL carry a version identifier, and the generated module SHALL expose it. This exists
so that a future corrected conversion is a new version rather than a silent rewrite of history
(`CONCEPT.md` §7.3, §8.4), even though Phase 0 defines no conversions to correct.

#### Scenario: Version is readable at runtime

- **WHEN** the generated module is imported
- **THEN** it exposes the spec version from the YAML

### Requirement: Font and French ordinals cannot be compared

Ordinals SHALL be typed per scale such that comparing, sorting or arithmetically combining an ordinal
of one scale with an ordinal of another is a compile-time error in the generated TypeScript. Runtime
assertions alone are insufficient: the namespaces must not merely be checked, they must be
unrepresentable together.

#### Scenario: Same-scale comparison compiles

- **WHEN** two French ordinals are compared
- **THEN** the code typechecks and the comparison reflects the label order

#### Scenario: Cross-scale comparison does not compile

- **WHEN** a French ordinal and a Font ordinal are passed to a comparison
- **THEN** typechecking fails

#### Scenario: Identical indices in different scales are not equal

- **WHEN** the index of French `6a` and the index of Font `6A` are both obtained
- **THEN** they may be the same integer, and no API treats that as equality of difficulty

### Requirement: An ordinal is a discriminated union from the first version

An ordinal SHALL be a tagged variant — `{ kind: 'exact', index }` — rather than a bare number, so that
adding a `range` variant for open grades later forces every consumer that must change to fail
typechecking. Phase 0 SHALL construct only the `exact` variant.

#### Scenario: Only exact ordinals are constructible

- **WHEN** the public API is used to obtain an ordinal for any label in either scale
- **THEN** the result carries `kind: 'exact'`

#### Scenario: Consumers narrow on the tag

- **WHEN** a consumer reads an ordinal's index
- **THEN** it does so after narrowing on `kind`, rather than by treating the ordinal as a number

### Requirement: Validation is case-sensitive and rejects unknown grades

Given a `(grade_raw, grade_scale)` pair, the module SHALL report whether `grade_raw` is a label of that
scale, comparing exactly. It SHALL NOT trim, lowercase, uppercase or otherwise normalise the input,
because case is the only thing distinguishing a boulder grade from a rope grade.

#### Scenario: A correct pair validates

- **WHEN** `("6a", "french")` or `("6A", "font")` is validated
- **THEN** it is accepted

#### Scenario: A case-mismatched pair is rejected

- **WHEN** `("6A", "french")` or `("6a", "font")` is validated
- **THEN** it is rejected rather than corrected

#### Scenario: Unknown labels are rejected

- **WHEN** `("6d", "french")`, `("V4", "font")` or `("", "french")` is validated
- **THEN** each is rejected

#### Scenario: The importer can reject a bad grade

- **WHEN** an imported tick carries a `(grade_raw, grade_scale)` pair that does not validate
- **THEN** the import can refuse it rather than storing an ungradeable tick

### Requirement: Index arithmetic supports the grid's working range

The module SHALL expose the operations the grade grid needs: the label list for a scale, label →
ordinal, ordinal → label, and clamping an index range to the scale's bounds, so that a default range
of `[min − 2 … max + 2]` can be computed without a consumer reimplementing bounds logic
(`DESIGN.md` §5).

#### Scenario: A range is clamped at the bottom of the scale

- **WHEN** a range starting two below the easiest label is requested
- **THEN** it starts at the easiest label rather than a negative index

#### Scenario: A range is clamped at the top of the scale

- **WHEN** a range ending two above the hardest label is requested
- **THEN** it ends at the hardest label

#### Scenario: Round-trip is lossless for every label

- **WHEN** every label in both scales is converted to an ordinal and back
- **THEN** the result equals the original label exactly, including case

### Requirement: The scales are structurally cross-checked

The two scales SHALL be verified against each other rather than only against themselves: their first
22 entries are identical apart from letter case, and they diverge only in the 9s, where French has
five values and Font one. This catches a typo in either list and demonstrates the case-only difference
the namespace separation depends on.

#### Scenario: The shared prefix differs only by case

- **WHEN** indices 0 through 21 of both scales are compared case-insensitively
- **THEN** each pair of labels is equal

#### Scenario: The scales diverge above the shared prefix

- **WHEN** the labels from index 22 upward are counted
- **THEN** French has five and Font has one

### Requirement: Generated output is committed and drift is detected

The TypeScript module generated from the YAML SHALL be committed to the repository, so that
typechecking and building the web app require no code generation step. A check SHALL fail when the
committed output does not match what the spec would generate.

#### Scenario: A clean checkout typechecks without codegen

- **WHEN** `just typecheck` runs on a fresh clone with only `pnpm install` completed
- **THEN** it succeeds without the generator having been run

#### Scenario: Drift is caught

- **WHEN** the YAML spec is edited and the generated module is not regenerated
- **THEN** the drift check fails

#### Scenario: Regeneration is deterministic

- **WHEN** the generator runs twice against an unchanged spec
- **THEN** the output is byte-identical, so the drift check cannot fail spuriously

### Requirement: No cross-scale conversion in Phase 0

The module SHALL NOT define conversions between scales. French, Font, V-scale, YDS, UIAA,
Scandinavian and Finnish comparisons are deferred (D1, D5), and Phase 0's single analytic groups
within a discipline.

#### Scenario: No conversion API is exposed

- **WHEN** the generated module's public surface is inspected
- **THEN** it offers no function converting an ordinal or label from one scale to another
