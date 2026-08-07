## MODIFIED Requirements

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
