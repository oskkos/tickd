## ADDED Requirements

### Requirement: Monorepo layout matches the target architecture

The repository SHALL be a pnpm workspace whose directory layout matches the structure recorded in
`CONCEPT.md` §8, so that later phases extend the tree rather than reshaping it. `apps/web` and
`packages/grade-spec` are the only workspace members populated in Phase 0. `backend/` SHALL exist and
SHALL be empty.

#### Scenario: Workspace members resolve

- **WHEN** `pnpm install` runs at the repository root
- **THEN** it completes without error and `apps/web` resolves as a workspace package

#### Scenario: Phase 1 directories are present but unpopulated

- **WHEN** the tree is inspected after scaffolding
- **THEN** `backend/` exists and contains no build files
- **AND** `packages/grade-spec/` exists as a workspace member with no generated modules

### Requirement: The justfile is the single build entrypoint

A `justfile` at the repository root SHALL expose every command a developer runs, delegating to pnpm.
It SHALL contain only targets that Phase 0 can execute successfully; a target that requires a backend,
a database, or codegen SHALL NOT be present.

#### Scenario: Phase 0 targets succeed

- **WHEN** `just dev`, `just build`, `just typecheck`, `just lint` or `just test` runs on a clean
  checkout after install
- **THEN** each completes without error

#### Scenario: No target requires absent infrastructure

- **WHEN** the justfile is read
- **THEN** no target invokes Gradle, Flyway, jOOQ, Docker, or OpenAPI generation

### Requirement: Phase 0 scope fence

The dependency tree SHALL NOT contain Phase 1 concerns. Specifically, the repository SHALL NOT contain
`packages/api-client`, `openapi.json`, `docker-compose.yml`, Gradle build files, Flyway migrations, or
jOOQ configuration, and `apps/web` SHALL NOT depend on an HTTP client or authentication library.

#### Scenario: Phase 1 artifacts are absent

- **WHEN** the repository is inspected after this change
- **THEN** none of the listed Phase 1 files or directories exist

#### Scenario: No network dependency in the web app

- **WHEN** `apps/web/package.json` is read
- **THEN** its dependencies include no HTTP, auth, or sync library

### Requirement: TypeScript strictness is enforced from the first commit

`apps/web` SHALL typecheck under TypeScript `strict` mode, and the typecheck SHALL be runnable without
a database, a backend, or generated code present.

#### Scenario: Typecheck passes standalone

- **WHEN** `just typecheck` runs on a fresh clone with only `pnpm install` completed
- **THEN** it exits successfully with no type errors
