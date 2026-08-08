# local-database

## Purpose

The Phase 0 client-side store: three tables, the row shapes over them, and the invariants that make a
corrupt row unrepresentable rather than merely discouraged. The client is the source of truth —
Dexie/IndexedDB serves every read and there is no network at all in Phase 0 (`CONCEPT.md` §8, §9.0).

**The invariants here fail silently rather than loudly, which is why they are types and not
validators.** A tick with `is_send: false` carrying `send_style: 'flash'` does not throw when
written; it inflates the flash-rate numerator permanently, and flash rate is the one Phase 0 analytic
(§4.2, D14). A Font label stored against a French scale records a harder climb in a notation it was
never graded with (§7.3, D5). A boulder carrying rope protection is counted in one view and dropped in
another (§7.4). None of these produce an error at the point of the mistake, so the point of the
mistake has to be a compile error.

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

#### Scenario: The three Phase 0 tables exist

- **WHEN** the database is opened
- **THEN** it exposes `venue`, `session` and `tick` stores and no others

#### Scenario: Phase 1 and Phase 2 columns are absent

- **WHEN** a row type is inspected
- **THEN** it declares no `user_id`, `device_id`, `schema_version`, `visibility` or `project_id` field

### Requirement: There is no route entity

A tick SHALL be anonymous. It SHALL identify what was climbed only by
`(venue, sector?, grade, protection, send_style, prior_experience, is_send, date)`, and the schema
SHALL NOT contain a route table, a route identifier, a natural key over route attributes, or lifecycle
fields such as `set_at` or `removed_at`.

Indoor routes cannot be identified: a newly set 6c+ in sector 4 is indistinguishable from the one it
replaced (§7.2, D2, D3).

#### Scenario: No route table or reference exists

- **WHEN** the schema is inspected
- **THEN** there is no route store, and no tick field references one

#### Scenario: Sector is free text, not an entity

- **WHEN** a tick records a sector
- **THEN** it is stored as an optional free-text value on the tick itself

### Requirement: Invalid style combinations do not compile

The tick row type SHALL make the two invalid combinations of `is_send`, `send_style` and
`prior_experience` unrepresentable, such that constructing one is a compile-time error rather than a
value rejected at runtime.

The two invalid combinations are: a `send_style` present when `is_send` is false, and `flash` or
`onsight` paired with a `prior_experience` other than `none` (§7.4, D6, D14).

Runtime validation alone is insufficient. A tick carrying `is_send: false` with `send_style: 'flash'`
does not fail on write; it inflates the flash-rate numerator permanently, which is the exact
corruption D14 exists to prevent.

#### Scenario: An attempt cannot carry a send style

- **WHEN** a tick with `is_send: false` and any `send_style` is constructed
- **THEN** typechecking fails

#### Scenario: An attempt omits the field rather than nulling it

- **WHEN** a tick with `is_send: false` sets `send_style` to `undefined`
- **THEN** typechecking fails, because the field must be absent

#### Scenario: A flash cannot follow prior experience

- **WHEN** a tick pairs `send_style: 'flash'` with `prior_experience: 'attempted'` or `'sent'`
- **THEN** typechecking fails

#### Scenario: A send requires a send style

- **WHEN** a tick with `is_send: true` omits `send_style`
- **THEN** typechecking fails

#### Scenario: Worked sends accept any prior experience

- **WHEN** a tick pairs `send_style: 'redpoint'` or `'second_go'` with `prior_experience: 'none'`
- **THEN** it typechecks, because several goes within one session leave the experience before the
  first go at none

#### Scenario: Removing the guard breaks the build

- **WHEN** the outcome union is widened so an invalid combination becomes representable
- **THEN** the type-level assertions fail rather than passing silently

#### Scenario: The invariant holds at the write path, not only on the row type

- **WHEN** an invalid tick is passed to the table's `add`, `put` or `bulkPut`
- **THEN** typechecking fails

Asserting only against the row type is insufficient and was insufficient in practice. A table typing
that derives its insert type from the row can flatten the union — `Omit` over a union keeps only the
common keys and merges their property types — leaving every row-type assertion passing while the
tables accept the rows they forbid. The write path is the only ingress the logging screen uses, so
the assertions SHALL read the parameter types off the table methods rather than restate them.

#### Scenario: Absence of a field is checked per union member

- **WHEN** a forbidden field such as a cached ordinal is added to a single member of the grade or
  outcome union
- **THEN** the assertion that the field is absent fails

`keyof` a union yields only the keys common to every member, so a check against `keyof Tick` cannot
see a field added to one member alone — which is how a per-scale cached ordinal would arrive.

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

The tick store SHALL carry a compound index over `(discipline, grade_scale)`, because every metric
groups by that pair.

Grouping by discipline alone pools Font and French boulders into one ranking of incomparable values;
grouping by scale alone pools boulders with routes. Either yields a plausible wrong number rather than
an error (§4.2, D17).

#### Scenario: The compound index exists

- **WHEN** the tick store's indexes are inspected
- **THEN** a compound index over discipline and grade scale is present

#### Scenario: Ticks are retrievable by the grouping key

- **WHEN** ticks are queried for one discipline and one scale
- **THEN** only ticks matching both are returned

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
normally on failure.

Handling a *rejecting* IndexedDB is not sufficient: a **hanging** open — the `blocked` event when
another tab holds the connection, or a browser that fires no event at all — leaves an awaited promise
unsettled and the first render never happens, producing a blank page with nothing to act on.

When storage is unusable the app SHALL say so. An empty venue list is indistinguishable from a first
launch, and the natural reading of an empty logbook is that the data is gone. §7.6 accepts losing data
to eviction; it does not accept failing to say that nothing is being saved.

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
