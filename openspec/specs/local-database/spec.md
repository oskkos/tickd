# local-database

## Purpose

The Phase 0 client-side store: three tables, the row shapes over them, and the invariants that make a
corrupt row unrepresentable rather than merely discouraged. The client is the source of truth —
Dexie/IndexedDB serves every read and there is no network at all in Phase 0 (`CONCEPT.md` §8, §9.0).

**The invariants here fail silently rather than loudly, which is why they are types and not
validators.** A Font label stored against a French scale records a harder climb in a notation it was
never graded with (§7.3, D5). A boulder carrying rope protection is counted in one view and dropped in
another (§7.4). A `prior_experience` of `none` on a go that was not the first manufactures a first
encounter, inflating the denominator of flash rate — the one Phase 0 analytic (§4.2, D14). None of these
produce an error at the point of the mistake, so the point of the mistake has to be a compile error.

**The strongest version of an invariant is one with nothing left to contradict.** Style was a stored
column that could disagree with its own neighbours, and the two combinations that made it wrong were
prevented by assertion; dropping it and deriving it instead (D20) made them unrepresentable rather than
merely rejected, which is why the requirement that policed them is gone rather than relaxed.

**An invariant that holds only for the row type is not enforced.** The write path — `add`, `put`,
`bulkPut` — is the sole ingress the UI uses, and a table typing that derives its insert type from the
row can flatten a discriminated union and accept exactly what the row type forbids. Assertions
therefore read the parameter types off the table methods rather than restating them.

Also here: migration-free versioning (D7 — Phase 0 data is disposable, so a schema change wipes and
restarts), seed venue identity (§7.5), the schema marker the JSON importer will compare against
(§7.6), and a startup sequence that neither hangs nor fails silently.

This capability separates *notations* only where `grade-scales` already does. Keeping disciplines
apart is the consuming layer's job, via `discipline` and `protection` on the tick (D17).

## Requirements

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

### Requirement: Discipline and protection cannot contradict each other

The tick row type SHALL pair `discipline` with `protection` such that `protection: 'none'` occurs
exactly on a boulder, and a roped discipline carries one of the roped protections. Constructing a
contradictory pair SHALL be a compile-time error.

`CONCEPT.md` §7.4 defines `protection: 'none'` as *meaning* boulder. Left independent, a
logging-screen bug that moves the discipline toggle while leaving `protection` behind writes a row
that is counted inconsistently rather than rejected: it lands in the boulder group of the
`(discipline, grade_scale)` index, while any consumer reading `protection === 'none'` as "is a
boulder" drops it. Two plausible contradictory numbers, which is the failure mode this capability
exists to prevent.

#### Scenario: A boulder with rope protection does not compile

- **WHEN** a tick pairs `discipline: 'boulder'` with `protection: 'lead'`
- **THEN** typechecking fails

#### Scenario: A roped climb without protection does not compile

- **WHEN** a tick pairs `discipline: 'sport'` with `protection: 'none'`
- **THEN** typechecking fails

#### Scenario: Valid pairings compile

- **WHEN** a tick pairs `boulder` with `none`, or `sport`/`trad` with `lead`, `toprope` or
  `autobelay`
- **THEN** it typechecks

### Requirement: A grade cannot disagree with its scale

The tick row type SHALL pair `grade_raw` with `grade_scale` such that a label belonging to one scale
cannot be stored against the other, using the literal label unions the grade spec generates.

Font `6A` and French `6a` differ only by letter case, so a mismatched pair is not a typo but a
different and harder climb recorded against the wrong notation.

#### Scenario: A matching pair compiles

- **WHEN** a tick pairs `grade_scale: 'french'` with `grade_raw: '6a'`
- **THEN** it typechecks

#### Scenario: A case-mismatched pair does not compile

- **WHEN** a tick pairs `grade_scale: 'french'` with `grade_raw: '6A'`
- **THEN** typechecking fails

#### Scenario: No ordinal is stored

- **WHEN** a tick row is inspected
- **THEN** it carries `grade_raw` and `grade_scale` only, and no precomputed ordinal or index

Baking an ordinal at write time would make a later correction to the conversion table rewrite history
(§7.3, §8.4).

### Requirement: Repeat status is derived, not stored

The schema SHALL NOT contain an `is_repeat` column. Repeat status SHALL be derived from
`prior_experience = 'sent'` (D6).

#### Scenario: No repeat column exists

- **WHEN** the tick row type is inspected
- **THEN** it declares no `is_repeat` field

### Requirement: The database declares exactly one version

The schema SHALL declare exactly one version and SHALL NOT contain migration or upgrade logic. Phase 0
data is disposable, so a schema change wipes and restarts rather than migrating (D7, §7.6).

Migration discipline begins at Phase 1, when the data becomes worth keeping.

#### Scenario: Only one version is declared

- **WHEN** the schema definition is inspected
- **THEN** exactly one version is declared and no upgrade callback is attached

#### Scenario: Adding a second version fails the build

- **WHEN** a second version is added to the schema
- **THEN** the test asserting a single version fails

### Requirement: A venue offers at least one discipline, and says which

A venue SHALL carry a default scale for each discipline it offers, and SHALL NOT carry one for a
discipline it does not. **A missing scale means that discipline is not available at that venue**, and
the type SHALL make a venue carrying neither scale unrepresentable — a venue nothing can be logged at
is not a venue.

Presence is the encoding rather than a separate list of disciplines, which would duplicate the same
fact and allow the two to disagree.

This says nothing about notation implying discipline. A scale still identifies only the notation the
venue grades in, and the same scale may serve both (D17).

#### Scenario: A venue offering both disciplines carries both scales

- **WHEN** a venue with ropes and boulders is read
- **THEN** it carries a rope scale and a boulder scale

#### Scenario: A boulder-only venue carries no rope scale

- **WHEN** a venue with no ropes is read
- **THEN** its rope scale is absent rather than set to a value nobody can use

#### Scenario: A venue offering nothing does not compile

- **WHEN** a venue with neither scale is constructed
- **THEN** typechecking fails

### Requirement: Seed venues are fixed and idempotent

The database SHALL be seeded with the Phase 0 venues, each carrying a stable hardcoded identifier so
that seeding converges rather than duplicating when run repeatedly.

The seed set SHALL be four locations across two brands: Kiipeilyareena Salmisaari and Kiipeilyareena
Ristikko, both `default_scale_boulder: 'font'`; and Tampereen Kiipeilykeskus Nekala and Tampereen
Kiipeilykeskus Lielahti, both `default_scale_boulder: 'french'`. Every venue except Lielahti SHALL
carry `default_scale_rope: 'french'`; **Lielahti is boulder-only and SHALL carry no rope scale.**

That one discipline takes two different scales across the seed set is the point, not an inconsistency:
a scale is a notation, not a discipline (D17).

#### Scenario: Seeding twice does not duplicate

- **WHEN** the seed routine runs against an already-seeded database
- **THEN** the venue count is unchanged

#### Scenario: Seeding an empty database inserts every venue

- **WHEN** the seed routine runs against a fresh database
- **THEN** all four venues are present

#### Scenario: Boulder scale differs across the seed set

- **WHEN** the seeded venues are read
- **THEN** the Kiipeilyareena sites report `font` for boulders and both Tampere sites report `french`

#### Scenario: Rope is French wherever it exists

- **WHEN** the seeded venues that offer rope are read
- **THEN** each reports `french`

#### Scenario: The boulder-only site is specifically the one without rope

- **WHEN** the seeded venues are read
- **THEN** Lielahti has no rope scale and every other venue does, so the absence is specific rather
  than a seeding bug that dropped the field everywhere

#### Scenario: Venues are locations, not brands

- **WHEN** the sites of either brand are read
- **THEN** they are separate venue rows sharing an optional brand value

#### Scenario: Sites within a brand are not interchangeable

- **WHEN** the two Tampereen Kiipeilykeskus sites are compared
- **THEN** one offers rope and the other does not, which is why a venue is a location

#### Scenario: Wall height is absent rather than guessed

- **WHEN** a seeded venue is read
- **THEN** `default_route_length_m` is absent, because the real values are not yet known

### Requirement: Identifiers are client-generated and collision-free

Rows SHALL take client-generated UUID primary keys rather than auto-incrementing counters, so that the
keys remain valid when a second device and a server exist (§8.3).

#### Scenario: A created row gets a UUID

- **WHEN** a session or tick is created
- **THEN** its identifier is a UUID generated on the client

#### Scenario: No auto-increment key is declared

- **WHEN** the schema definition is inspected
- **THEN** no store declares an auto-incrementing primary key

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

### Requirement: A schema marker is exported and derived from the shape

The module SHALL export a schema marker identifying the Phase 0 shape, so that the JSON importer can
refuse a mismatched file rather than upgrading it (§7.6).

The marker SHALL be **derived from the schema rather than hand-maintained**: from the store and index
definitions, and from an exhaustive list of stored fields that the type system requires to be updated
when a row gains a field. A marker a developer must remember to bump is one they can forget, and
forgetting it lets an export of the old shape import cleanly into the new one — defeating the refusal
that D7 relies on in place of migrations.

The marker exists here rather than in the importer because it identifies the schema, and the schema is
defined here. Refusal logic belongs to the import change.

#### Scenario: The marker is readable

- **WHEN** the database module is imported
- **THEN** it exposes a schema marker value

#### Scenario: An index change moves the marker

- **WHEN** a store or index definition changes
- **THEN** the marker changes without anyone editing it

#### Scenario: A new row field cannot be added silently

- **WHEN** a field is added to a row type but not to the stored-field list
- **THEN** typechecking fails, and adding it to the list moves the marker

### Requirement: Storage persistence is requested best-effort

The app SHALL request storage persistence once at startup via `navigator.storage.persist()`, and SHALL
continue normally when the API is unavailable or the request is refused.

A persisted origin is exempt from best-effort eviction. The API is Chromium-only — Safari does not
implement it — so absence is an expected outcome rather than an error (§7.6).

#### Scenario: Persistence is requested when available

- **WHEN** the app starts in a browser implementing the Storage API
- **THEN** persistence is requested exactly once

#### Scenario: An unsupporting browser still works

- **WHEN** the app starts where `navigator.storage.persist` is undefined
- **THEN** startup completes without error and logging remains available

#### Scenario: A refusal is not fatal

- **WHEN** the browser declines the persistence request
- **THEN** the app continues, because Phase 0 accepts evictable storage

### Requirement: Startup never blocks or fails silently

Startup SHALL be bounded in time and SHALL report whether storage is usable, rather than resolving
normally on failure. **The bound SHALL cover every step awaited before first render, not merely the
database open.**

A bound that covers only the first step is not a bound. Seeding was raced against the timeout while a
later read was awaited *after* that race had already settled, which left an unbounded tail on the one
promise first render waits for — reproducing exactly the blank page the bound exists to prevent, one
operation further along. Any step added to the boot sequence therefore goes inside the bound, or the
guarantee decays every time the sequence grows.

#### Scenario: A hanging open does not block first render

- **WHEN** the database open neither succeeds nor fails
- **THEN** startup completes within a bounded time and the app renders

#### Scenario: A rejected open does not throw

- **WHEN** IndexedDB rejects, as in private browsing
- **THEN** startup completes and reports that storage is unavailable

#### Scenario: The user is told the logbook cannot save

- **WHEN** storage is unavailable or timed out
- **THEN** the UI shows a message saying so, rather than an empty list with no explanation

#### Scenario: A healthy start shows no warning

- **WHEN** storage opens normally
- **THEN** no warning is shown

#### Scenario: The bound covers every step before first render

- **WHEN** a storage operation after seeding hangs, rather than the open itself
- **THEN** startup still completes within the bounded time and the app renders

### Requirement: Identifier generation does not depend on a secure context

Identifier generation SHALL work outside a secure context, because the stated device-testing route is
a phone reaching the development server over plain http.

`crypto.randomUUID` is secure-context only. Calling it unguarded throws on the first identifier
minted, so a tap that is supposed to persist immediately silently does nothing.

#### Scenario: Identifiers are still generated without randomUUID

- **WHEN** `crypto.randomUUID` is unavailable
- **THEN** a valid version 4 UUID is still produced, and distinct on each call

### Requirement: The storage layer is testable without a browser

The database SHALL be exercisable in the test environment with no browser and no manual setup, since
jsdom provides no IndexedDB implementation.

Each test SHALL observe a fresh database, because a shared one lets seed-idempotence tests pass for
the wrong reason.

#### Scenario: Tests run headless

- **WHEN** the test suite runs under the existing runner
- **THEN** database tests execute against an in-memory IndexedDB

#### Scenario: Tests are isolated from each other

- **WHEN** two tests write conflicting rows
- **THEN** neither observes the other's data
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
