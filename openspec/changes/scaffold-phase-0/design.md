## Context

The repository holds `CONCEPT.md`, `DESIGN.md`, a logo, seven UI mockups and a licence. There is no
build of any kind. Almost every technical choice this change needs was already argued through and
recorded: the UI stack in `DESIGN.md` §5, hosting in `CONCEPT.md` §9.0, the monorepo layout in §8,
build orchestration in §8, typography in `DESIGN.md` §1, and the phasing fence in §5 and §11.

So this design is mostly *assembly under existing constraints* rather than new decision-making. Where it
does decide something, that is called out below. The one genuinely new operational surface is the
Cloudflare Pages project, which does not exist yet.

The trial device is a Galaxy S26 Ultra on Android, which makes Chromium the only browser engine
that matters for Phase 0 and means `navigator.storage.persist()` is available.

## Goals / Non-Goals

**Goals:**

- A pnpm workspace whose shape matches §8, so Phase 1 extends it instead of reshaping it.
- An installable, offline-capable app shell on the trial device, with theming and typography working.
- A Cloudflare Pages deployment from `develop`, on `*.pages.dev`.
- A `justfile` that is the only command surface a developer needs.
- Enough structural rigidity that a later change adding Dexie or the grade grid has an obvious place
  to put things.

**Non-Goals:**

- Any data layer. No Dexie, no tables, no persistence, no `persist()` call — that belongs with the
  change that introduces `venue` / `session` / `tick`.
- Any screen from the mockups. The shell renders a placeholder, not the logging flow.
- The grade grid or any grade logic. `packages/grade-spec` is created empty on purpose.
- Anything from Phase 1: Gradle, Flyway, jOOQ, `openapi.json`, `packages/api-client`,
  `docker-compose.yml`, auth, sync.
- A custom domain. Deferred by D16, with the name-availability risk accepted in §11.
- CI beyond what Cloudflare Pages runs to build the site.

## Decisions

**Vite + React + TypeScript, strict mode from the first commit.** Recorded in §8. Strict from the start
because retrofitting it across a grown codebase is the expensive version of the same work.

**pnpm workspaces for TypeScript, `justfile` over Nx or Turborepo.** §8 rejects both — neither handles
Gradle well enough, and Gradle arrives in Phase 1. Choosing a JS-only orchestrator now would mean
replacing it then. `just` delegates to pnpm and later to Gradle without changing shape.

**`packages/grade-spec` is created as a workspace member but left empty.** The alternative — omitting it
until it has content — was rejected because its existence is what makes the eventual generated-module
import path obvious, and because §13 explicitly asks for the scaffold to anticipate it. The same
reasoning covers the empty `backend/`.

**`vite-plugin-pwa` for the manifest and service worker,** rather than hand-writing a worker. The
generated worker gives precaching and update handling, which are the two things the `app-shell` spec
requires and the two easiest to get subtly wrong by hand. Trade-off: a build-time dependency owns a file
that matters operationally, so the cache-header requirement in `web-deployment` exists to bound the
damage from a bad worker reaching clients.

**Service worker registration uses prompt-on-update rather than silent auto-reload.** Auto-reloading
mid-session is unacceptable for an app whose whole premise is logging in fragments — a reload during
entry would be indistinguishable from data loss to the user. Since no data exists yet this is
precautionary, but the registration strategy is easier to set correctly now than to change once screens
depend on it.

**daisyUI skin classes only; Base UI owns behaviour.** From `DESIGN.md` §5, restated here because the
scaffold is where the habit forms. `data-theme` goes on `<html>` in `index.html`, not on a React root
element, so portalled content inherits it.

**Fonts are committed `.woff2` subsets, self-hosted, preloaded.** Required by `DESIGN.md` §1 for two
independent reasons — offline precaching and the GDPR ruling against CDN-embedded Google Fonts. Subsetting
to Latin keeps the precache small enough that the offline requirement stays cheap.

**Cloudflare Pages is connected to the GitHub repository rather than deployed from a local CLI.** A
git-push deploy means the deployed origin always corresponds to a commit, which matters more than usual
here because the trial device installs from that origin and its IndexedDB will later be the only copy of
real data. Local `wrangler` pushes would make "what is actually on the phone" ambiguous.

**Preview deployments are left enabled.** They land on separate origins, which is desirable: a preview
physically cannot read the trial data. The corresponding discipline — never install from a preview URL —
is recorded in `CONCEPT.md` §9.0.

**Theme selection is a placeholder in this change.** The shell must prove both themes work, but where the
toggle lives and whether it persists is a settings-screen concern (mockup 7). This change hardcodes a
default and exposes a temporary switch.

## Risks / Trade-offs

- **Scope creep into Phase 0** → The `build-tooling` spec enumerates the forbidden Phase 1 artifacts as
  testable requirements, so a violation shows up as a failing check rather than as a judgement call in
  review. This is the risk §11 names as the whole game.
- **A bad service worker reaches the installed app and pins it to a broken build** → The worker is never
  served with a long cache lifetime, and update handling is verified on the device as part of this change
  rather than assumed. Worst case recovery is uninstall and reinstall, which is free while no data exists
  — another reason to do this change before any data layer.
- **`vite-plugin-pwa` conventions drift from the hand-written manifest assumptions in `DESIGN.md` §2** →
  Generate the manifest through the plugin and treat `DESIGN.md` as the source of truth for icon
  geometry, verifying the emitted manifest against it once on the device.
- **The Cloudflare account and Pages project are manual, out-of-repo state** → Record the project's
  settings (production branch, build command, output directory) in the repository so the configuration is
  reproducible even though the account is not.
- **Empty directories carry no weight in git** → `backend/` and `packages/grade-spec/` need a placeholder
  file each, or they will silently vanish on clone and Phase 1 begins with the reshuffle §13 was trying
  to avoid.
- **Installability regressions are invisible until someone tries to install** → Verified manually on the
  trial device in this change; automating it is not worth doing at this size, and the manual check is
  cheap while the app is one screen.

## Migration Plan

Nothing exists, so there is nothing to migrate and no rollback beyond reverting the commit. The
deployment step is the only irreversible-ish action: creating the Pages project fixes the `*.pages.dev`
hostname. That hostname is deliberately disposable (D16), so a wrong choice costs nothing.

Ordering that matters: the workspace and web app must build locally before the Pages project is created,
so the first deployment is a build that is already known to succeed.

## Open Questions

- **The exact `*.pages.dev` subdomain**, which follows from the Pages project name. Disposable, so it
  needs a decision but not a considered one.
- **Whether `just test` has anything to run in this change.** A test runner is worth wiring up now, but
  the shell may have nothing meaningful to assert beyond "it renders". Wiring the runner with a trivial
  test is the cheaper option than adding it later under pressure.
- **Font subsetting boundaries** — Latin plus the characters Finnish venue names need. Resolvable while
  implementing rather than before.
