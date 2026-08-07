# tickd — single entrypoint over pnpm workspaces.
#
# Phase 0 only. Gradle, Flyway, jOOQ, Docker and OpenAPI generation arrive in Phase 1 and must not
# appear here before then: a target that cannot run is worse than a missing one.
# See openspec/specs/build-tooling.
#
# Only the comment line directly above a recipe becomes its description in `just --list`, so keep
# those to one line and put longer notes inside the recipe body.

default: dev

# Install workspace dependencies.
install:
    pnpm install

# Run the web app locally with hot reload.
dev:
    pnpm --filter @tickd/web dev

# Serve on the LAN for layout checks on a phone — not a secure context.
dev-lan:
    # http:// on a LAN address is not a secure context: no service worker, no persist(), no install.
    # Use a tunnel when any of those matter (CONCEPT.md §9.0).
    pnpm --filter @tickd/web dev --host

# Regenerate code from versioned specs.
codegen:
    # Fans out like typecheck/lint/test: any package declaring a `codegen` script is picked up with
    # no edit here. `--filter` is reserved for genuinely web-specific recipes.
    pnpm -r codegen

# Fail if committed generated code disagrees with its spec.
codegen-check:
    # Compares in memory and never writes, so this is safe on a dirty tree and cannot be confused
    # with uncommitted work.
    pnpm -r codegen:check

# Production build.
build:
    pnpm --filter @tickd/web build

# Serve the production build locally.
preview: build
    pnpm --filter @tickd/web preview

# Typecheck every workspace package.
typecheck:
    # Deliberately requires no backend, database or generated code.
    pnpm -r typecheck

# Lint every workspace package.
lint:
    pnpm -r lint

# Run tests in every workspace package.
test:
    pnpm -r test

# Everything CI would run. The single definition of "the tree is fine" — the git hooks and the CI
# workflow both defer to these recipes rather than restating the commands.
#
# Ordered cheapest-first so a trivial failure does not wait behind lint: codegen-check ~0.6s,
# fmt-check ~1.0s, typecheck ~1.9s, lint ~3.6s, test ~2.1s.
check: codegen-check fmt-check typecheck lint test build

# Rewrite sources with Prettier.
fmt:
    pnpm exec prettier --write .

# Fail if anything is unformatted.
fmt-check:
    pnpm exec prettier --check .
