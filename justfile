# tickd — single entrypoint over pnpm workspaces.
#
# Phase 0 only. Gradle, Flyway, jOOQ, Docker and OpenAPI generation arrive in Phase 1 and must not
# appear here before then: a target that cannot run is worse than a missing one.
# See openspec/specs/build-tooling.

default: dev

# Install workspace dependencies.
install:
    pnpm install

# Run the web app locally with hot reload.
dev:
    pnpm --filter @tickd/web dev

# Serve on the LAN — layout checks on a phone only. Not a secure context, so no service worker,
# no persist(), no install. Use a tunnel for anything that needs those (CONCEPT.md §9.0).
dev-lan:
    pnpm --filter @tickd/web dev --host

# Production build.
build:
    pnpm --filter @tickd/web build

# Serve the production build locally.
preview: build
    pnpm --filter @tickd/web preview

# Typecheck every workspace package. Requires no backend, database or generated code.
typecheck:
    pnpm -r typecheck

lint:
    pnpm -r lint

test:
    pnpm -r test

# Everything CI would run.
check: typecheck lint test build

# Rewrite sources with Prettier.
fmt:
    pnpm exec prettier --write .

fmt-check:
    pnpm exec prettier --check .
