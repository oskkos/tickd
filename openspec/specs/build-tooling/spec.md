# build-tooling

## Purpose

The repository's shape and command surface: the pnpm workspace layout, the `justfile` that fronts every
command, and the fence that keeps Phase 1 tooling out of a Phase 0 tree. Phase 0 discipline is the
stated main risk (`CONCEPT.md` §11), so the fence is expressed as testable requirements rather than
left to review judgement.

## Requirements

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

`packages/grade-spec` is populated, so it is no longer an example of a deliberately empty member.
`backend/` remains the only one.

### Requirement: The justfile is the single build entrypoint

A `justfile` at the repository root SHALL expose every command a developer runs, delegating to pnpm.
It SHALL contain only targets that Phase 0 can execute successfully; a target that requires a backend,
a database, or Phase 1's codegen chain SHALL NOT be present.

**Local, dependency-free code generation is not what that exclusion is about.** The generator in
`packages/grade-spec` reads a YAML file and writes a TypeScript module — no services, no network, no
Docker. It is the Flyway → jOOQ → OpenAPI → TS-client chain (`CONCEPT.md` §8) that must stay out until
Phase 1, because it needs a migrated Postgres to run at all.

Aggregate recipes SHALL fan out across the workspace (`pnpm -r <script>`) rather than naming a single
package, so a second package declaring the same script needs no edit to the justfile. `--filter` is
reserved for recipes that are genuinely specific to one package, such as running the web dev server.

**The justfile is also the definition CI and the git hooks defer to.** Neither restates a check as its
own shell command, so there is one place a check can be added or changed and no way for the three to
drift apart.

#### Scenario: Phase 0 targets succeed

- **WHEN** `just dev`, `just build`, `just typecheck`, `just lint`, `just test` or `just codegen` runs
  on a clean checkout after install
- **THEN** each completes without error

#### Scenario: No target requires absent infrastructure

- **WHEN** the justfile is read
- **THEN** no target invokes Gradle, Flyway, jOOQ, Docker, or OpenAPI generation

#### Scenario: The aggregate check includes drift

- **WHEN** `just check` runs
- **THEN** it fails if any committed generated module disagrees with the spec it came from

#### Scenario: The aggregate check includes formatting

- **WHEN** `just check` runs against a tree containing an unformatted file
- **THEN** it fails

#### Scenario: CI and the hooks invoke the recipes rather than the commands

- **WHEN** the CI workflow and the git hooks are read
- **THEN** each calls `just <recipe>` and none reimplements a check as its own command line

### Requirement: Phase 0 scope fence

The dependency tree SHALL NOT contain Phase 1 concerns. Specifically, the repository SHALL NOT contain
`packages/api-client`, `openapi.json`, `docker-compose.yml`, Gradle build files, Flyway migrations, or
jOOQ configuration, and `apps/web` SHALL NOT depend on an HTTP client or authentication library.

#### Scenario: Phase 1 artifacts are absent

- **WHEN** the repository is inspected
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
