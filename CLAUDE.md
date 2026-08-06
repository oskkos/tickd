# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

**tickd** — an indoor climbing logbook (rope and boulder). Mobile-first, offline-capable PWA.

**Nothing is built yet.** The repo contains only design documents, a logo (`tickd.png`), and a
LICENSE. There is no `package.json`, no Gradle build, no source tree, and therefore no build, lint
or test commands. Everything under "Planned architecture" below is specification, not code.

The two documents are the product:

- **`CONCEPT.md`** — owns *what* the app does and *why*: market position, phasing, data model,
  stack choices, hosting, risks.
- **`DESIGN.md`** — owns *how it looks*: logo, typography, colour, the logging screen layout, the
  component-library decision.

They cross-reference by section number (`CONCEPT.md` §7.4) rather than restating each other. Keep
that boundary when editing: a flow change goes in CONCEPT, its visual expression in DESIGN.

## Feature workflow — OpenSpec

**Every new feature goes through OpenSpec. Do not start editing code from a bare prompt.**
Specs live in `openspec/` (`specs/` for current behaviour, `changes/` for in-flight change folders,
`changes/archive/` for shipped ones). The chain is:

1. **`/opsx:explore`** — think through the idea, investigate, clarify requirements. No artifacts yet.
2. **`/opsx:propose`** — create the change folder and generate its artifacts (proposal, design,
   delta specs, tasks). This is the review gate: the user approves the proposal before any code.
3. **`/opsx:apply`** — implement the tasks from the approved change, ticking them off as they land.
4. **`/opsx:archive`** — fold the delta specs into `openspec/specs/` and move the change to
   `changes/archive/` once it is implemented and verified.

**During `/opsx:apply`, commit once per top-level task group** — after every task under a `## N.` heading
is finished and its checkboxes are ticked, including the `tasks.md` update in that same commit. One
group, one commit.

- **Never commit a half-finished group.** If a group is abandoned mid-way, say so and leave it
  uncommitted rather than banking a partial state that reads as complete.
- **The commit message follows the group**, not the change: `## 2. The generator` becomes
  `feat(grade-spec): add the scale generator`, with the type chosen for what that group actually did
  (`test:` for a test-only group, `build:` for wiring).
- **A group whose tasks are pure verification** (`## 6. Verify`) still gets a commit if it ticked
  boxes or produced fixes; if it changed nothing but checkboxes, fold it into the previous commit
  instead of making an empty-ish one.
- **Groups are not pushed automatically.** Push when the user asks, or when the whole change is done.

`/opsx:sync` folds delta specs into the main specs *without* archiving — use it when a change is
still in flight but its specs have settled.

Small, obvious edits (a typo, a doc tweak, a one-line fix) don't need a change folder. Anything that
adds behaviour, alters the data model, or touches an invariant below does.

## Git workflow

**Never commit directly to `develop`. All work happens on a branch.** `develop` is the main branch and
receives work through pull requests, not direct pushes — including documentation-only changes.

Branch per OpenSpec change, named after it so the two are obvious together:

```
<type>/<change-name>        feat/scaffold-phase-0, docs/phase-0-hosting
```

**Commit messages follow [Conventional Commits](https://www.conventionalcommits.org):**

```
<type>(<scope>)?: <imperative subject>

<body — why, not what; wrap at 100>
```

- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `build`, `ci`, `chore`.
- Scopes track the monorepo: `web`, `grade-spec`, `backend`, `docs`, `openspec`. Optional — omit rather
  than invent one.
- Subject is imperative and lower-case, no trailing period: `feat(web): add grade grid`.
- Breaking changes use `!` before the colon, plus a `BREAKING CHANGE:` footer.

**Commits before this convention was adopted do not follow it.** History up to and including the
`scaffold-phase-0` proposal is plain sentence-case subjects. Don't rewrite it; just don't imitate it.

## Working with the documents

**The decision log at the end of `CONCEPT.md` (D1–D15) records positions that were argued through
and changed.** Read it before proposing an alternative — most obvious-seeming suggestions
(a `route` table, colour-coded grades, one flat style enum, an always-on VPS, Quarkus, GraalVM,
Terraform, 8a.nu CSV import, a native mobile app) were already considered and rejected there, with
reasoning. If a
decision genuinely needs revisiting, append a new numbered entry rather than silently editing the
body.

Both files carry a `Last updated:` line — update it when making substantive edits.

## Invariants that are easy to violate

These fall out of decisions spread across several sections; getting one wrong corrupts data or
metrics rather than just looking wrong.

**There is no route entity.** A tick is anonymous: `(venue, sector?, grade, protection, send_style,
prior_experience, is_send, date)`. Indoor routes cannot be identified — a newly set 6c+ in sector 4
is indistinguishable from the one it replaced. Do not add route matching, natural keys, lifecycle
fields (`set_at`/`removed_at`), or a "currently up" view. Projects (Phase 2) are a user-named
grouping key, not a route. (CONCEPT §7.2, D2, D3)

**Font and French are separate ordinal namespaces.** Font `6A` (boulder) and French `6a` (rope)
differ only by letter case and mean very different difficulties. One shared *UI* grid component,
never one shared ordinal scale — mapping them together puts boulders and routes on the same pyramid
and corrupts every metric. Correspondingly: **never apply `text-transform` to `grade_raw`**;
grade text renders verbatim. (CONCEPT §7.3, DESIGN §2)

**Store `grade_raw` + `grade_scale`; convert to ordinals at read time** through a versioned
conversion table. Never bake a canonical ordinal at write time — conversion is lossy and contested,
so a correction would otherwise rewrite history. The scale spec is one versioned YAML file that
generates both the Kotlin and TypeScript implementations. (CONCEPT §7.3, §8.4)

**Style is three orthogonal fields, not one enum:**

```
protection        lead | toprope | autobelay | none       -- none = boulder
send_style        onsight | flash | redpoint | second_go  -- null exactly when is_send = false
prior_experience  none | attempted | sent                 -- before this tick's first go
```

Two combinations are invalid and the UI must make them unreachable: `flash`/`onsight` requires
`prior_experience = none`, and `send_style` is null exactly when `is_send = false`. `is_repeat` is
derived from `prior_experience = sent`. (CONCEPT §7.4, D6, D14)

**Flash rate = flashes ÷ first encounters**, where a first encounter is any tick with
`prior_experience = none` — *including* ones never sent. Dividing by sends is biased upward at
exactly the limit grade the metric exists to find. This is the one metric that deliberately does
*not* filter `is_send = true`. (CONCEPT §4.2, D14)

**Segment, never exclude.** Every metric breaks down by `protection` and `send_style` rather than
dropping auto-belay laps or toprope. No global ranking, no points system — comparison is against
your own past self. (CONCEPT §4.2, D6)

**No onsight option in the indoor UI.** The value stays in the model for outdoor use only.
(CONCEPT §6)

## Phasing

Phase 0 discipline is the stated main risk. Do not build Phase 1+ concerns into Phase 0.

- **Phase 0** — local-only PWA, Dexie/IndexedDB, three tables (`venue`, `session`, `tick`).
  **No accounts, no backend, no sync, no user concept at all, no backup.** Data is disposable, so
  schema changes may wipe and restart — **write no Dexie migrations**. Ships ticking plus exactly
  one analytic (flash rate by grade), `navigator.storage.persist()`, and manual JSON export *and*
  import buttons. Seed venues are hardcoded. Hosting is Cloudflare Pages on its free `*.pages.dev`
  subdomain — a throwaway origin the app leaves at Phase 1 (CONCEPT §9.0, D16).
  **The importer replaces rather than merges, and refuses a schema-marker mismatch instead of
  upgrading it** — merging would invent Phase 1's conflict rules, and upgrading would be a Dexie
  migration by another name.
- **Phase 1** — Kotlin/Spring Boot backend, OAuth2, sync. Adds `app_user`, `user_identity`, and
  `user_id`/`device_id`/`schema_version`/`visibility` on existing tables. Migration discipline
  starts here.
- **Phase 2** — `project` grouping and `session_note` (append-only entries, not one edited field).
  Attempts are already captured in Phase 0 via `is_send = false`; this phase adds the views.
- **Phase 3** — social. **Phase 4** — optional gym partnerships.

Explicitly never planned: outdoor guidebook data from any source; a route database; logbook import.

**Distribution is web-first.** A Google Play listing via TWA (CONCEPT §10) stays possible but is
uncommitted and belongs to Phase 3/4 at the earliest. Three things keep it open and must not be
broken: the PWA keeps passing installability criteria, the app stays single-origin, and — if a
listing is ever published — the custom domain is chosen *before* the first APK, because the origin
is baked into every install and cannot be moved afterwards (§10.2). There is no second codebase; a
TWA is a pointer at the origin.

## Planned architecture

None of this exists yet. Scaffolding the monorepo is the stated next step, with only `apps/web` and
`packages/grade-spec` populated in Phase 0.

```
/
├── backend/              Gradle, Kotlin, Spring Boot 4.1, jOOQ 3.21
│   ├── src/main/resources/db/migration/    Flyway SQL — schema source of truth
│   └── build/generated/                    jOOQ classes (committed)
├── apps/web/             Vite + React + TypeScript PWA
├── packages/
│   ├── grade-spec/       versioned YAML + generators → Kotlin and TS
│   └── api-client/       TS client generated from OpenAPI (committed)
├── openapi.json          generated, committed
├── docker-compose.yml    local Postgres
└── justfile              single entrypoint over pnpm workspaces + Gradle
```

**Codegen chain:** Flyway migrate → jOOQ codegen → build backend → emit OpenAPI → generate TS
client → build web. **Generated code is committed** (jOOQ classes, `openapi.json`, TS client,
generated grade modules) so frontend typechecking doesn't require Docker and a migrated Postgres;
CI regenerates and fails on drift.

Build orchestration is a `justfile`, not Nx or Turborepo — neither handles Gradle well enough here.
pnpm workspaces for TypeScript, Gradle for Kotlin.

**Client is the source of truth.** Dexie/IndexedDB serves all reads; the network is a background
outbox flush. This is what makes Cloud Run scale-to-zero viable and what makes offline logging work.
Sync is budgeted at 2–3 weeks (CONCEPT §8.3), uses an outbox plus pull cursor, plain `DELETE`/
`UPDATE` with last-write-wins on `updated_at`, no tombstones, and a periodic full re-sync on launch
to catch offline deletes.

**Auth is OAuth2 only, never passwords**, with Spring Boot as the OAuth2 *client* (backend-for-
frontend): the PWA gets an `httpOnly` session cookie and never sees a token. Consequences — the PWA
and API must be same-origin (the JAR serves the PWA from `src/main/resources/static/`), sessions are
sliding ~90 days, offline logging must never depend on auth, and the sync queue treats `401` as
*pause and re-authenticate* rather than a permanent failure. Identity joins on
`(provider, provider_subject_id)` — **never on email**. (CONCEPT §8.6)

## Planned UI stack

**Tailwind + daisyUI for appearance, Base UI for behaviour. From Phase 0. No MUI.**

- Package is **`@base-ui/react`** — the widely-cited `@base-ui-components/react` is deprecated and
  will show up constantly in older snippets.
- Use daisyUI's *skin* classes (`btn`, `menu`, `tabs`, `card`, `input`); avoid its *behavioural* ones
  (`.dropdown`, `.modal` open-state, `.collapse`) — Base UI owns that state.
- **`modal-box` is not a skin class — do not use it on a Base UI popup.** daisyUI 5 ships it as
  `opacity: 0; scale: .95` and only reveals it through a `.modal` parent's open state, which Base UI
  deliberately does not provide. The result is an invisible dialog with a working backdrop, which
  reads as a rendering bug rather than a CSS one. Style popups with plain utilities over daisyUI's
  theme tokens (`bg-base-100`, `rounded-box`, `text-base-content`). `apps/web/src/App.test.tsx` has a
  guard.
- **Put `data-theme` on `<html>`, never a subtree** — portalled dialogs and drawers render outside
  the React root and would miss a scoped theme.
- Themes: daisyUI `dim` (dark) and `winter` (light). Dark mode is not optional; gyms are dimly lit.
- The grade grid is plain `<button>`s — the one place a library is actively wrong.

Typography: Poppins 600 headings, Lato 400 body, **self-hosted `.woff2` committed to the repo**
(offline precaching, plus the GDPR ruling against CDN-embedded Google Fonts). Tabular figures for
grade and stat columns.

Physical constraints that are requirements, not taste: 48–56 px touch targets (chalky fingers),
primary actions in the lower thumb-reachable third (one-handed use), every tap persists immediately
(sessions are logged in fragments), and undo is persistent and visible rather than a transient toast.

## Testing approach (planned)

Testcontainers with real PostgreSQL for every jOOQ query — the analytics SQL is the hard part and an
in-memory fake tests nothing. Property-based tests on grade conversion run against the shared spec on
**both** the Kotlin and TypeScript sides so they cannot diverge. Unit tests assert Font and French
ordinals never mix, and integration tests replay a recorded offline session through sync including
duplicate flush and partial failure.