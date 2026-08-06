## Why

The repository contains design documents and nothing else — no `package.json`, no source tree, no
build. `CONCEPT.md` §13 names scaffolding the monorepo as the next step, and §9.0 now specifies where
Phase 0 is hosted, so both halves of "get something onto the phone" are decided and unblocked.

Doing it now, before any feature work, means the first thing that exists is an installable PWA on the
trial device (Galaxy S26 Ultra). That is the cheapest end-to-end validation available: it proves the
origin, the manifest, the service worker and the icon set all work together while there is almost no
code to debug. Every later change then lands on something already deployable.

## What Changes

- **A pnpm workspace monorepo** with `apps/web` (Vite + React + TypeScript) and an empty
  `packages/grade-spec`, plus an empty `backend/` directory so Phase 1 does not begin with a repo
  reshuffle (§13).
- **A `justfile` as the single entrypoint**, carrying only targets Phase 0 can actually run.
- **The UI stack from Phase 0**: Tailwind + daisyUI for appearance, Base UI for behaviour, `dim` and
  `winter` themes with `data-theme` on `<html>`, and self-hosted Poppins/Lato `.woff2` committed to
  the repo.
- **PWA installability**: web manifest, service worker via `vite-plugin-pwa`, and the icon set
  `DESIGN.md` §2 specifies — maskable PNG 512 with artwork inside the centre 80%, opaque
  `apple-touch-icon` 180.
- **Cloudflare Pages deployment** on the free `*.pages.dev` subdomain per §9.0, with SPA fallback,
  service-worker cache headers, and `develop` as the production branch.
- **An app shell that renders and installs, and nothing more.** No Dexie, no tables, no logging flow,
  no grade grid, no analytics. Those are separate changes.

Explicitly **not** in this change, though the target architecture names them: `packages/api-client`,
`openapi.json`, `docker-compose.yml`, Gradle, Flyway, jOOQ, and the codegen chain. All are Phase 1.
`backend/` is created empty and stays empty.

## Capabilities

### New Capabilities

- `build-tooling`: monorepo layout, pnpm workspace boundaries, the `justfile` entrypoint, and the
  Phase 0 scope fence that keeps Phase 1 tooling out of the tree.
- `app-shell`: the installable, offline-capable PWA shell — manifest, service worker, icons, theming,
  typography, and the physical layout constraints that apply to every screen built later.
- `web-deployment`: hosting on Cloudflare Pages, the origin's lifecycle, SPA fallback, cache
  behaviour, and the separation between the trial origin and preview deploys.

### Modified Capabilities

None. `openspec/specs/` is empty; this is the first change in the repository.

## Impact

- **New**: `pnpm-workspace.yaml`, `package.json`, `justfile`, `apps/web/**`, empty
  `packages/grade-spec/` and `backend/`, `.gitignore`, Cloudflare Pages configuration.
- **Documents**: none change. This change implements `CONCEPT.md` §9.0 and §13 and `DESIGN.md` §1–§2
  as already written.
- **External**: a Cloudflare account and a Pages project connected to the GitHub repository. No
  domain purchase — deliberately deferred (D16).
- **Risk**: this is the change most exposed to Phase 0 scope creep (§11). The fence in `build-tooling`
  exists to make violations visible rather than convenient.
