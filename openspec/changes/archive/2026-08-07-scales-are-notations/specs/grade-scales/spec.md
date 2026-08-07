## MODIFIED Requirements

### Requirement: Validation is case-sensitive and rejects unknown grades

Given a `(grade_raw, grade_scale)` pair, the module SHALL report whether `grade_raw` is a label of that
scale, comparing exactly. It SHALL NOT trim, lowercase, uppercase or otherwise normalise the input,
because case is the only thing distinguishing a Font label from a French one.

`6A` and `6a` are different grades on different scales. Normalising either way silently reassigns a
grade to the wrong scale — which is a different and worse failure than rejecting it.

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

### Requirement: No cross-scale conversion in Phase 0

The module SHALL NOT define conversions between scales. French, Font, V-scale, YDS, UIAA,
Scandinavian and Finnish comparisons are deferred (D1, D5).

**A consequence that is accepted rather than avoided:** because a discipline can be graded on different
scales at different venues, a Phase 0 analytic groups within a discipline *and* within a scale. Two
gyms grading boulders on two scales therefore produce two boulder pyramids, not one. Merging them needs
the conversion table this requirement excludes (D17).

#### Scenario: No conversion API is exposed

- **WHEN** the generated module's public surface is inspected
- **THEN** it offers no function converting an ordinal or label from one scale to another

#### Scenario: Two scales for one discipline do not merge

- **WHEN** boulders logged at one venue use Font and boulders at another use French
- **THEN** they are reported as two separate distributions rather than combined into one ranking

## ADDED Requirements

### Requirement: A scale is a notation, not a discipline

A scale identifies the notation a grade is written in. It SHALL NOT be treated as implying the
discipline that grade describes. French serves rope everywhere and boulders at venues that grade them
that way; Font serves boulders at venues that use it.

Separation is therefore two-layer, and each layer has a job the other cannot do:

- **The type system separates notations.** A Font ordinal and a French ordinal cannot be compared, and
  that is a compile error.
- **The consuming layer separates disciplines.** `discipline` and `protection` are fields on the tick,
  not properties of a grade, so no grade-level type can enforce it.

Neither layer is sufficient alone. A boulder and a rope route can share a scale, and two boulders can
have different scales.

#### Scenario: The same scale serves both disciplines

- **WHEN** a venue grades its boulders in French
- **THEN** a boulder tick and a rope tick may both carry `grade_scale = 'french'`, and both are valid

#### Scenario: One discipline spans two scales

- **WHEN** boulders are logged at a Font venue and a French venue
- **THEN** both are valid, and no part of the system treats one scale as the boulder scale

#### Scenario: The scale records the notation, not an interpretation

- **WHEN** a boulder graded `6a` on a French-grading wall is stored
- **THEN** `grade_scale` is `french`, matching what was entered

A scale id encoding "this is a boulder" would bake an interpretation at write time — the same error
`CONCEPT.md` §7.3 forbids for ordinals, and for the same reason: the interpretation may be revised, and
the record of what was entered must not be.

#### Scenario: Metrics key on discipline and scale together

- **WHEN** a distribution over grades is computed
- **THEN** its grouping key includes both the discipline and the scale

Keying on discipline alone pools incomparable scales into one ranking. Keying on scale alone pools
boulders with routes. Both produce a plausible-looking wrong number rather than an error.
