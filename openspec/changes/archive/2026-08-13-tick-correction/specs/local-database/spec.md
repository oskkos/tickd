## ADDED Requirements

### Requirement: A tick's unions are corrected whole, never patched

The storage layer SHALL provide a write path that replaces a tick's grade, its discipline-and-protection and
its outcome as whole values. That path SHALL write the complete row rather than a partial, and SHALL be the
only way those fields change after a tick is written. The annotation path SHALL remain confined to the fields
outside those unions.

A partial of a discriminated union is unsound: `{ grade_raw }` without `grade_scale`, or `{ protection }`
without `discipline`, describes a row that is half of one union member and half of another. The type system
cannot reject it because the object never claims to be a whole row, and the result is precisely the
inconsistently-counted row the paired unions exist to prevent — a boulder on lead lands in one group of the
`[discipline+grade_scale]` index while every consumer reading `protection === 'none'` as "is a boulder" drops
it. Writing the row whole is what makes the pairing checkable again.

#### Scenario: The correction path takes paired values

- **WHEN** the correction helper is handed a grade, a discipline-and-protection, and an outcome
- **THEN** each arrives as a complete union member, and a half of one does not compile

#### Scenario: A partial union cannot reach the table through the correction path

- **WHEN** a correction is attempted with a grade label but no scale, or a protection but no discipline
- **THEN** it does not compile

#### Scenario: The annotation path is unchanged

- **WHEN** the annotation helper is inspected
- **THEN** it still writes only fields outside the grade, discipline and outcome unions

### Requirement: A correction preserves a tick's identity, its place in time, and its annotations

Correcting a tick SHALL preserve its `id`, its `session_id`, its `created_at`, its `date_local` and its
`tz_offset`, and SHALL preserve every annotation field the row carries. It SHALL update `updated_at`.
Correction SHALL NOT be implemented as a delete followed by a fresh write.

A climb belongs to the local day it was climbed. A correction that re-stamped the row would move a Tuesday
go to whichever day the mistake was noticed — silently, and unrepairably in a phase with no migrations —
and would move it to the end of the session in every ordering besides. Preserving the annotations is the
other half: the correction writes the whole row, so any field not carried across is not merely stale but
gone, and `notes` has no other copy.

#### Scenario: The day the climb happened does not move

- **WHEN** a tick logged on one local date is corrected on a later one
- **THEN** its `date_local`, `tz_offset` and `created_at` are unchanged

#### Scenario: The row keeps its identity

- **WHEN** a tick is corrected
- **THEN** it has the same `id` and the same `session_id`, and the session's tick count is unchanged

#### Scenario: Annotations are carried across the whole-row write

- **WHEN** a tick carrying `notes`, `rating`, `grade_opinion`, `angle`, `holds` and `length_m` has its
  outcome corrected
- **THEN** all six are still present on the stored row

#### Scenario: The correction is recorded as a modification

- **WHEN** a tick is corrected
- **THEN** its `updated_at` reflects the correction while `created_at` does not

### Requirement: A correction cannot move a tick between scales or disciplines

The correction path SHALL reject a grade whose scale differs from the one the tick already carries, and SHALL
reject a discipline-and-protection whose discipline differs from the tick's own. A label crossing from
untyped input into the grade union SHALL be checked against the tick's stored scale rather than asserted.

Font `6A` and French `6a` differ only by letter case, so a scale swap silently records a different climb, and
converting between the notations is deferred (D17). The discipline is the same constraint seen from the other
side: it selects the scale, so changing it invalidates the grade beside it. Refusing both at the storage
layer means the rule does not depend on the interface enforcing it — the control that would offer the choice
simply does not exist, and this is what makes that absence load-bearing rather than cosmetic.

#### Scenario: A cross-scale correction is refused

- **WHEN** a tick recorded in Font is corrected with a French label
- **THEN** the correction does not compile, or is refused rather than written

#### Scenario: A cross-discipline correction is refused

- **WHEN** a boulder tick is corrected to a roped discipline-and-protection
- **THEN** the correction does not compile, or is refused rather than written

#### Scenario: An untrusted label is validated against the tick's own scale

- **WHEN** a grade label arrives from the interface for a correction
- **THEN** it is paired with the tick's stored scale by a check that can fail, rather than by assertion

## MODIFIED Requirements

### Requirement: The row invariants hold at the write path, not only on the row type

Every invariant asserted about a tick row SHALL hold for the type accepted by the code that writes one.
No write path SHALL reach the table through a cast that discards the row's unions. This SHALL hold for every
write path, not only the one that creates a tick: a helper that corrects an existing row is a write path and
carries the same obligation.

**Proving an invariant on `Tick` is a different claim from "an invalid row cannot be written", and the
gap was a real defect rather than a hypothetical.** The helper that logs a tick took `discipline` and
`protection` as independent fields beside `grade_scale` and `grade_raw`, built the row, and asserted the
result. Every type-level assertion in the suite was written against the table's `add` parameter, so the
cast walked past all of them at once: a boulder on lead, and a French label under `grade_scale: 'font'`,
both compiled and persisted. The invariant was advertised on the row type and absent from the only path
that writes one.

The corollary is about where assertions point. Assertions aimed at the row type cannot detect this,
because the row type was never wrong. They SHALL be written against the accepting types — the table's
own `add`/`put` parameters, and the draft type of any helper that writes — so a regression is a compile
error rather than a row that cannot be repaired in a phase with no migrations.

Where a value must cross from untyped input into a paired union, it SHALL be checked rather than
asserted. A label arriving from the UI carries no proof it came from the scale currently rendered, so the
boundary is a function that returns the union or nothing.

#### Scenario: A mismatched pair cannot be drafted

- **WHEN** a write helper is handed a boulder with a rope protection, or a label from the other scale
- **THEN** it does not compile

#### Scenario: The write path holds no cast that erases the unions

- **WHEN** the code that writes a tick is inspected
- **THEN** the row it builds is checked against the row type rather than asserted into it

#### Scenario: Assertions are made against what the writer accepts

- **WHEN** the type-level assertions are inspected
- **THEN** they are written against the accepting parameter types, not restated row shapes

#### Scenario: An untrusted label is validated, not cast

- **WHEN** a grade label arrives from the interface
- **THEN** it is paired with its scale by a check that can fail, rather than by assertion

#### Scenario: The correction path is asserted like the logging path

- **WHEN** the type-level assertions are inspected
- **THEN** the correction helper's accepted type is asserted against the same invariants as the draft type,
  with controls proving the valid shapes still reach it
