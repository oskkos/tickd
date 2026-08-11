## ADDED Requirements

### Requirement: Routes are declared in code, not generated

The router's route tree SHALL be hand-written. The repository SHALL NOT contain a generated route-tree
file or the build plugin that produces one.

A generated file enlists the drift check, the pre-commit hooks and CI for every future edit, and that
cost is only worth paying when the generated content is large enough or error-prone enough to earn it.
Phase 0's route tree is two tabs and one detail route.

#### Scenario: No generated route tree exists

- **WHEN** the repository is inspected
- **THEN** no generated route-tree module is present and no route-generation plugin is configured

#### Scenario: Typecheck still needs no generation step

- **WHEN** `just typecheck` runs on a fresh clone with only `pnpm install` completed
- **THEN** it exits successfully

## MODIFIED Requirements

### Requirement: Phase 0 scope fence

The dependency tree SHALL NOT contain Phase 1 concerns. Specifically, the repository SHALL NOT contain
`packages/api-client`, `openapi.json`, `docker-compose.yml`, Gradle build files, Flyway migrations, or
jOOQ configuration, and `apps/web` SHALL NOT depend on an HTTP client, an authentication library, or a
server-state or data-fetching library.

A client-side router is **not** within the fence: it serves navigation between local screens and has no
network dependency. A server-state library such as TanStack Query is, and the distinction matters
because the two ship from the same family and would otherwise be adopted together. Phase 0 has no
network to fetch from, and the client is the source of truth rather than a cache in front of one — the
local database serves all reads directly, so a query cache would be a second copy of the authority with
nothing to reconcile it against.

#### Scenario: Phase 1 artifacts are absent

- **WHEN** the repository is inspected
- **THEN** none of the listed Phase 1 files or directories exist

#### Scenario: No network dependency in the web app

- **WHEN** `apps/web/package.json` is read
- **THEN** its dependencies include no HTTP, auth, sync, or server-state library

#### Scenario: A router is permitted

- **WHEN** `apps/web/package.json` is read
- **THEN** a client-side routing dependency does not constitute a fence violation
