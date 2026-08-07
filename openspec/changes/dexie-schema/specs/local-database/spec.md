## ADDED Requirements

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

### Requirement: Seed venues are fixed and idempotent

The database SHALL be seeded with the Phase 0 venues, each carrying a stable hardcoded identifier so
that seeding converges rather than duplicating when run repeatedly.

The seed set SHALL be Kiipeilyareena Salmisaari and Kiipeilyareena Ristikko — both
`default_scale_boulder: 'font'` — and Tampereen Kiipeilykeskus with `default_scale_boulder: 'french'`.
All three SHALL carry `default_scale_rope: 'french'`.

That one discipline takes two different scales across the seed set is the point, not an inconsistency:
a scale is a notation, not a discipline (D17).

#### Scenario: Seeding twice does not duplicate

- **WHEN** the seed routine runs against an already-seeded database
- **THEN** the venue count is unchanged

#### Scenario: Seeding an empty database inserts every venue

- **WHEN** the seed routine runs against a fresh database
- **THEN** all three venues are present

#### Scenario: Boulder scale differs across the seed set

- **WHEN** the seeded venues are read
- **THEN** the Kiipeilyareena sites report `font` for boulders and Tampereen Kiipeilykeskus reports
  `french`, while all three report `french` for rope

#### Scenario: Venues are locations, not brands

- **WHEN** the two Kiipeilyareena sites are read
- **THEN** they are separate venue rows sharing an optional brand value

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

### Requirement: A schema marker is exported for the importer

The module SHALL export a schema marker identifying the Phase 0 shape, so that the JSON importer can
refuse a mismatched file rather than upgrading it (§7.6).

The marker exists here rather than in the importer because it identifies the schema, and the schema is
defined here. Refusal logic belongs to the import change.

#### Scenario: The marker is readable

- **WHEN** the database module is imported
- **THEN** it exposes a schema marker value

#### Scenario: The marker changes with the shape

- **WHEN** the table shape changes
- **THEN** the marker is expected to change with it, so an older export is recognisably incompatible

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
