## MODIFIED Requirements

### Requirement: Monorepo layout matches the target architecture

The repository SHALL be a pnpm workspace whose directory layout matches the structure recorded in
`CONCEPT.md` §8, so that later phases extend the tree rather than reshaping it. `apps/web` and
`packages/grade-spec` are the only workspace members populated in Phase 0. `backend/` SHALL exist and
SHALL be empty.

#### Scenario: Workspace members resolve

- **WHEN** `pnpm install` runs at the repository root
- **THEN** it completes without error and `apps/web` resolves as a workspace package

#### Scenario: Phase 1 directories are present but unpopulated

- **WHEN** the tree is inspected
- **THEN** `backend/` exists and contains no build files

`packages/grade-spec` is now populated, so it is no longer an example of a deliberately empty member.
`backend/` remains the only one.

### Requirement: The justfile is the single build entrypoint

A `justfile` at the repository root SHALL expose every command a developer runs, delegating to pnpm.
It SHALL contain only targets that Phase 0 can execute successfully; a target that requires a backend,
a database, or Phase 1's codegen chain SHALL NOT be present.

**Local, dependency-free code generation is not what that exclusion is about.** The generator in
`packages/grade-spec` reads a YAML file and writes a TypeScript module — no services, no network, no
Docker. It is the Flyway → jOOQ → OpenAPI → TS-client chain (`CONCEPT.md` §8) that must stay out until
Phase 1, because it needs a migrated Postgres to run at all.

#### Scenario: Phase 0 targets succeed

- **WHEN** `just dev`, `just build`, `just typecheck`, `just lint`, `just test` or `just codegen` runs
  on a clean checkout after install
- **THEN** each completes without error

#### Scenario: No target requires absent infrastructure

- **WHEN** the justfile is read
- **THEN** no target invokes Gradle, Flyway, jOOQ, Docker, or OpenAPI generation

#### Scenario: The aggregate check includes drift

- **WHEN** `just check` runs
- **THEN** it fails if the committed generated module disagrees with the YAML spec
