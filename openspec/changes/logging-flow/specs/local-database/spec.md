## MODIFIED Requirements

### Requirement: The store holds exactly the Phase 0 tables

The client database SHALL define three object stores — `venue`, `session` and `tick` — with the fields
enumerated in the Phase 0 block of `CONCEPT.md` §7.7, and SHALL NOT define Phase 1 or Phase 2 tables or
columns.

Phase 1 adds `app_user`, `user_identity` and the `user_id`/`device_id`/`schema_version`/`visibility`
columns; Phase 2 adds `session_note` and `project`. A single-device disposable database needs none of
them, and there is nothing to backfill.

**Phase 0 carries only what the screen writes.** D7 makes adding a column later free — data is
disposable and a schema change is the wipe-and-restart already accepted — so there is no reason to carry
a field ahead of a consumer. `send_style`, `attempts`, `sector`, `high_point` and `tick.venue_id` are
therefore absent from the tick, and `conditions` and `felt` from the session (D18, D19, D20, D21).

#### Scenario: The three Phase 0 tables exist

- **WHEN** the database is opened
- **THEN** it exposes `venue`, `session` and `tick` stores and no others

#### Scenario: Phase 1 and Phase 2 columns are absent

- **WHEN** a row type is inspected
- **THEN** it declares no `user_id`, `device_id`, `schema_version`, `visibility` or `project_id` field

#### Scenario: Dropped columns are absent

- **WHEN** the tick row type is inspected
- **THEN** it declares no `send_style`, `attempts`, `sector`, `high_point` or `venue_id` field

#### Scenario: Session-level narrative columns are absent

- **WHEN** the session row type is inspected
- **THEN** it declares no `conditions` or `felt` field, because `notes` on a tick carries them

### Requirement: There is no route entity

A tick SHALL be anonymous. It SHALL identify what was climbed only by
`(grade, protection, prior_experience, is_send, date)` together with the session it belongs to, and the
schema SHALL NOT contain a route table, a route identifier, a natural key over route attributes, or
lifecycle fields such as `set_at` or `removed_at`.

Indoor routes cannot be identified: a newly set 6c+ in sector 4 is indistinguishable from the one it
replaced (§7.2, D2, D3).

**The identity tuple is shorter than §7.2 originally stated.** `sector` and `send_style` are gone, and
`venue` is reached through the session rather than stored on the tick — so what remains is the climb as
performed, plus where and when the session was.

#### Scenario: No route table or reference exists

- **WHEN** the schema is inspected
- **THEN** there is no route store, and no tick field references one

#### Scenario: No grouping key links goes on the same climb

- **WHEN** several ticks record goes on one climb
- **THEN** nothing in the schema connects them, because a session-scoped climb entity is deferred (D21)

### Requirement: Metrics can be queried by discipline and scale together

The tick store SHALL carry a compound index over `(discipline, grade_scale)`, because every metric groups
by that pair, and SHALL NOT index `venue_id`, which no longer exists on the tick.

Grouping by discipline alone pools Font and French boulders into one ranking of incomparable values;
grouping by scale alone pools boulders with routes. Either yields a plausible wrong number rather than an
error (§4.2, D17).

#### Scenario: The compound index exists

- **WHEN** the tick store's indexes are inspected
- **THEN** a compound index over discipline and grade scale is present

#### Scenario: Ticks are retrievable by the grouping key

- **WHEN** ticks are queried for one discipline and one scale
- **THEN** only ticks matching both are returned

#### Scenario: A venue-scoped query goes through the session

- **WHEN** the ticks logged at one venue are needed
- **THEN** they are found via that venue's sessions, since the tick carries no venue of its own

### Requirement: Startup never blocks or fails silently

Startup SHALL be bounded in time and SHALL report whether storage is usable, rather than resolving
normally on failure. **The bound SHALL cover every step awaited before first render, not merely the
database open.**

A bound that covers only the first step is not a bound. Seeding was raced against the timeout while a
later read was awaited *after* that race had already settled, which left an unbounded tail on the one
promise first render waits for — reproducing exactly the blank page the bound exists to prevent, one
operation further along. Any step added to the boot sequence therefore goes inside the bound, or the
guarantee decays every time the sequence grows.

#### Scenario: The bound covers every step before first render

- **WHEN** a storage operation after seeding hangs, rather than the open itself
- **THEN** startup still completes within the bounded time and the app renders

## REMOVED Requirements

### Requirement: Invalid style combinations do not compile

**Reason**: The two invalid combinations no longer exist to be prevented. `send_style` is dropped and
derived (D20), so there is no second field that can contradict `prior_experience` and no way to express
`send_style` on a tick that is not a send. The requirement is removed rather than relaxed — the guarantee
it described is now structural, and a weakened version of it would misrepresent what changed.

This is not a retreat from the invariant. `CLAUDE.md` requires the UI to make the combinations
unreachable; after D20 they are unrepresentable, which is strictly stronger. The replacement is
**Style is derived, never stored**, below.

**Migration**: Delete `send_style` from the tick row type and the `TickOutcome` union, which stops being
a union. Replace every assertion about invalid style combinations with the derivation tests in
**Style is derived, never stored**. Existing Phase 0 data is disposable (D7), so the schema change is a
wipe-and-restart rather than a migration.

## ADDED Requirements

### Requirement: A tick records one go

A tick SHALL record a single attempt on a climb, not a climb's worth of attempts. `prior_experience`
SHALL be read relative to that go: the history before **this** go began.

Four goes on one route are four ticks. The first carries `prior_experience = 'none'` and the rest carry
`'attempted'`, so exactly one first encounter is recorded and flash rate's denominator counts the climb
once (§4.2, D14).

This replaces §7.4's example of four goes logged as one redpoint row, which assumed a tick could span
several goes.

#### Scenario: Each go is its own row

- **WHEN** a climber falls three times and sends on the fourth go
- **THEN** four ticks exist

#### Scenario: Only the first go is a first encounter

- **WHEN** those four ticks are read
- **THEN** exactly one carries `prior_experience = 'none'`, so the climb contributes one row to flash
  rate's denominator rather than four

### Requirement: Style is derived, never stored

The schema SHALL NOT contain a `send_style` column. Send style SHALL be derived at read time from
`is_send` and `prior_experience`.

```
is_send && prior_experience = 'none'   →  flash
is_send && otherwise                   →  redpoint
!is_send                               →  no style
```

Because a tick is one go, a send with no prior experience *is* the first acquaintance and can only be a
flash. Storing the value would store something computable from the two fields beside it — which is how it
becomes able to disagree with them, and is the same error §7.3 forbids for ordinals.

All six combinations of `prior_experience` and `is_send` are valid. **There is no invalid combination
left to police.**

#### Scenario: No style column exists

- **WHEN** the tick row type is inspected
- **THEN** it declares no `send_style` field, and no `onsight`, `flash`, `redpoint` or `second_go` enum

#### Scenario: Every outcome combination is representable

- **WHEN** a tick pairs any `prior_experience` with either value of `is_send`
- **THEN** it typechecks, because all six states are valid

#### Scenario: A flash is derived, not asserted

- **WHEN** a tick has `is_send: true` and `prior_experience: 'none'`
- **THEN** it is reported as a flash without any stored value saying so

#### Scenario: Flash rate reads the derivation

- **WHEN** flash rate is computed
- **THEN** its numerator counts ticks with `is_send` and `prior_experience = 'none'`, and its denominator
  counts every tick with `prior_experience = 'none'` including ones never sent

#### Scenario: Repeat status remains derived

- **WHEN** a tick has `prior_experience = 'sent'`
- **THEN** it is a repeat, derived as before, with no `is_repeat` column (D6)

### Requirement: Route characteristics are typed, not free text

Where a tick records what the climb was like, it SHALL do so through typed fields rather than free-text
tags: `angle` as at most one of `slab`, `vertical`, `overhang`, `roof`; and `holds` as any number of
`crimp`, `sloper`, `pinch`, `pocket`, `jug`.

Free text fragments — *overhang*, *overhung*, *roof* and *steep* are one concept and four strings. A
single flat enum over both would repeat D6's error at a smaller scale, since a route is not overhanging
*or* crimpy but both; wall angle and hold type are independent questions.

`angle` is singular because it is the one that groups, slotting into the existing key as
`(discipline, grade_scale, angle)` with no array handling.

#### Scenario: Angle admits one value

- **WHEN** a tick records an angle
- **THEN** it holds a single value from the enum, not a list

#### Scenario: Holds admit several

- **WHEN** a tick records hold types
- **THEN** it may hold more than one value

#### Scenario: Free-text characteristics are not accepted

- **WHEN** the tick row type is inspected
- **THEN** it declares no `tags` field and no free-text characteristic

#### Scenario: Both are optional

- **WHEN** a tick is written without either
- **THEN** it is valid, because these are descriptive and no Phase 0 metric reads them

### Requirement: The row invariants hold at the write path, not only on the row type

Every invariant asserted about a tick row SHALL hold for the type accepted by the code that writes one.
No write path SHALL reach the table through a cast that discards the row's unions.

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

### Requirement: A stored row may outlive the labels its scale recognises

Reading grades back SHALL tolerate a row whose label its scale no longer contains, rather than failing
the whole read.

The pairing the row type guarantees holds for rows this build wrote. It does not hold for rows already on
disk, and in a phase with no migrations those are the only rows that matter: a label the current grade
spec no longer recognises is permanent. A throwing lookup inside a read over many ticks rejects the
entire result, so one unreadable row cost a discipline its working range for the whole ninety-day window,
with nothing surfaced in the interface.

#### Scenario: One unreadable row does not fail the read

- **WHEN** a stored tick carries a label its `grade_scale` does not contain
- **THEN** it is skipped and the remaining ticks are still read

#### Scenario: No readable rows reads as no history

- **WHEN** every recent tick for a pair is unreadable
- **THEN** the result is the same as having no ticks, rather than an error

### Requirement: A session is opened at most once

Opening a session SHALL be atomic with respect to checking whether one is already open.

"At most one session is open at a time" is relied upon silently by every reader that looks the open
session up, and two taps on a start control produced two rows with no end. The lookup then chooses
between them in primary-key order — effectively arbitrary — so a later launch could resume the empty one
and report nothing logged for a session the climber had filled, while a lazy close closes one and leaves
the other running.

#### Scenario: Two starts in flight produce one session

- **WHEN** a session start is requested twice before the first completes
- **THEN** one session exists afterwards and both requests report the same one
