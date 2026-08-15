## ADDED Requirements

### Requirement: The whole database can be replaced in one transaction

The storage layer SHALL expose a replace path that empties all three tables and writes a supplied set of
venues, sessions and ticks in a single read-write transaction across all three.

It SHALL be all-or-nothing. A failure part-way — a quota exhaustion, a closing connection — SHALL leave the
previous logbook intact rather than a half-replaced one, which is the one outcome worse than either a
successful restore or a refused file: it would be a logbook the user believes is one thing and is another.

The replace SHALL write rows exactly as supplied, without re-stamping identifiers or timestamps. It is a
restore, not a re-log.

This is not a migration and SHALL NOT become one. The caller is responsible for having refused a file whose
schema marker does not match; nothing in this path transforms a row from one shape to another.

#### Scenario: Every table is replaced

- **WHEN** the replace path runs against a populated database
- **THEN** each of the three tables afterwards contains exactly the supplied rows

#### Scenario: A failure part-way leaves the old logbook

- **WHEN** the replace path fails during the write
- **THEN** the database still holds the rows it held before the call

#### Scenario: Supplied rows are written verbatim

- **WHEN** rows carrying their own identifiers and timestamps are supplied
- **THEN** those values are stored unchanged

### Requirement: The whole database can be emptied in one transaction

The storage layer SHALL expose a delete path that empties all three tables in a single read-write
transaction, all-or-nothing on the same terms as the replace path.

Emptying venues as well is deliberate and is safe because seeding restores them on the next launch: the seed
rows are authoritative in Phase 0 (§7.5) and are not user data. Leaving them behind would make the operation
harder to describe than to perform.

#### Scenario: Every table is emptied

- **WHEN** the delete path runs
- **THEN** no venue, session or tick row remains

#### Scenario: A launch after a delete is a first launch

- **WHEN** the app starts after the delete path has run
- **THEN** seeding inserts the seed venues and the app is usable

## MODIFIED Requirements

### Requirement: Storage persistence is requested best-effort

The app SHALL request storage persistence once at startup via `navigator.storage.persist()`, and SHALL
continue normally when the API is unavailable or the request is refused.

A persisted origin is exempt from best-effort eviction. The API is Chromium-only — Safari does not
implement it — so absence is an expected outcome rather than an error (§7.6).

The storage layer SHALL also expose a **read** of the current persistence state, distinguishing persisted,
not persisted, and unsupported, and this read SHALL NOT request persistence. Requesting is a startup
concern and repeats on every launch, so a refusal is retried without anyone asking; reporting is a separate
question — *is the logbook protected right now* — and it needs an answer that can be taken at any moment
without a second request or a stored outcome from boot.

Both the request and the read SHALL live in the same module, so the guard against a browser that ships
`navigator.storage` without these methods — and the environment where `navigator.storage` is absent
entirely — is written once.

#### Scenario: Persistence is requested when available

- **WHEN** the app starts in a browser implementing the Storage API
- **THEN** persistence is requested exactly once

#### Scenario: An unsupporting browser still works

- **WHEN** the app starts where `navigator.storage.persist` is undefined
- **THEN** startup completes without error and logging remains available

#### Scenario: A refusal is not fatal

- **WHEN** the browser declines the persistence request
- **THEN** the app continues, because Phase 0 accepts evictable storage

#### Scenario: The current state is readable

- **WHEN** the persistence state is read on an origin that has been granted persistence
- **THEN** it reports persisted

#### Scenario: Reading does not request

- **WHEN** the persistence state is read
- **THEN** no persistence request is issued

#### Scenario: An unsupporting browser reads as unsupported

- **WHEN** the persistence state is read where the Storage API has no `persisted`
- **THEN** it reports unsupported rather than not-persisted

#### Scenario: A failing read is not fatal

- **WHEN** reading the persistence state throws
- **THEN** the caller receives an outcome rather than an exception
