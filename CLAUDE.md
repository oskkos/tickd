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
   `changes/archive/` once it is implemented and verified. **On the feature branch, before the PR
   merges** — see below.

**During `/opsx:apply`, commit once per top-level task group** — after every task under a `## N.` heading
is finished and its checkboxes are ticked, including the `tasks.md` update in that same commit. One
group, one commit.

- **Never commit a half-finished group.** If a group is abandoned mid-way, say so and leave it
  uncommitted rather than banking a partial state that reads as complete.
- **The commit message follows the group**, not the change: `## 2. The generator` becomes
  `feat(grade-spec): add the scale generator`, with the type chosen for what that group actually did
  (`test:` for a test-only group, `build:` for wiring).
- **A verification group** (`## 6. Verify`) gets its own commit even when it only ticks checkboxes.
  The message is the artifact: it records what was checked, against what broken state, and with what
  result. That is worth more than a tidy diff.
- **Groups are not pushed automatically.** Push when the user asks, or when the whole change is done.
- **The archive is its own commit**, after the last task group: `docs(openspec): archive <change> and
  add the <capability> baseline`. It carries both the spec fold-in and the folder move, so the two
  cannot drift apart.

**Archive on the feature branch, and always sync as part of it.** Both halves are forced rather than
preferred:

- **`develop` is protected**, so nothing can be committed to it directly. An archive done "after the
  merge" has nowhere to land — it would need its own branch and its own PR to fold in specs for work
  that already shipped. So the archive commit belongs on the same feature branch as the
  implementation, before the PR merges, and one merge ships the code and its baseline together.
- **Never archive without syncing.** Archiving moves the change folder under `changes/archive/`,
  which takes its delta specs out of the live tree with it. Skip the sync and the requirements exist
  only inside an archived folder — `openspec/specs/` never learns about the capability, and the next
  change reads a baseline that is missing whatever this one established. When `/opsx:archive` offers
  "archive without syncing", that is the wrong answer here.

`/opsx:sync` folds delta specs into the main specs *without* archiving — use it when a change is
still in flight but its specs have settled. It is not a substitute for the sync inside archive; it
is for the case where the specs land early and the tasks are still running.

Small, obvious edits (a typo, a doc tweak, a one-line fix) don't need a change folder. Anything that
adds behaviour, alters the data model, or touches an invariant below does.

## Git workflow

**Never commit directly to `develop`. All work happens on a branch.** `develop` is the main branch and
receives work through pull requests, not direct pushes — including documentation-only changes. This is
a **GitHub ruleset, not a convention**: a direct push is rejected by the server, which is why
`/opsx:archive` runs on the feature branch rather than after the merge.

Branch per OpenSpec change, named after it so the two are obvious together:

```
<type>/<change-name>        feat/scaffold-phase-0, docs/phase-0-hosting
```

**Both of the rules below are enforced by git hooks, not just documented.** `.githooks/pre-commit` runs
`codegen-check`, `fmt-check`, `typecheck` and `lint` (~7 s); `.githooks/commit-msg` validates the subject
against the types and scopes below. They activate via a `prepare` script on `pnpm install` — but pnpm
skips lifecycle scripts when it reports "Already up to date", so **`just install-hooks` is the repair
path, not `pnpm install`**.

`git commit --no-verify` bypasses both. **CI does not bypass**: `.github/workflows/ci.yml` runs the full
`just check` on every pull request and every push to `develop`, in ~45 s. Treat CI as the real gate and
the hook as the fast feedback loop.

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

**Font and French are separate ordinal namespaces.** Font `6A` and French `6a` differ only by letter
case and mean very different difficulties. One shared *UI* grid component, never one shared ordinal
scale. Correspondingly: **never apply `text-transform` to `grade_raw`**; grade text renders verbatim.
(CONCEPT §7.3, DESIGN §2)

**A scale is a notation, not a discipline.** Kiipeilyareena grades boulders in Font; Tampere grades
them in **French**. So one scale spans two disciplines and one discipline spans two scales — "French
for rope, Font for boulder" was a coincidence of two gyms, not a rule (CONCEPT §7.3, D17). Separation
is two-layer and neither layer can do the other's job:

- **Notation** — separated by the type system; comparing a Font ordinal with a French one is a
  compile error.
- **Discipline** — separated by the consuming layer, since `discipline` and `protection` are fields
  on the tick, not properties of a grade.

**Every metric therefore groups by `(discipline, grade_scale)`.** Grouping by discipline alone pools
Font and French boulders into one ranking of incomparable values; grouping by scale alone pools
boulders with routes. Either yields a plausible wrong number rather than an error. Two boulder scales
means two boulder pyramids in Phase 0 — the merging conversion table is deferred (D17).

**Store `grade_raw` + `grade_scale`; convert to ordinals at read time** through a versioned
conversion table. Never bake a canonical ordinal at write time — conversion is lossy and contested,
so a correction would otherwise rewrite history. The scale spec is one versioned YAML file that
generates both the Kotlin and TypeScript implementations. (CONCEPT §7.3, §8.4)

**Style is two stored fields plus a derived one:**

```
protection        lead | toprope | autobelay | none       -- none = boulder, paired with discipline
prior_experience  none | attempted | sent                 -- history before THIS GO
is_send           true | false

send_style        DERIVED: is_send && prior_experience = none -> flash, else redpoint
```

**A tick records one go** (D20). Four goes on one route are four rows — the first `none`, the rest
`attempted` — so exactly one first encounter is recorded. Nothing links those rows; the session-scoped
grouping that would was designed and deferred (D21).

**There are no invalid style combinations left to police.** §7.4 named two, and `CLAUDE.md` used to
require the UI to make them unreachable. Dropping `send_style` made them **unrepresentable**: all six
pairings of `prior_experience` and `is_send` are valid, and no second field exists to contradict the
first. Do not reintroduce a stored style — it is computable from its own neighbours, which is how a
value becomes able to disagree with them (§7.3's rule, applied beyond ordinals).

`prior_experience` **cannot be defaulted.** It is correct on the first go and wrong on every go after,
and being wrong manufactures first encounters that inflate flash rate's denominator. The UI forces
the choice. `is_repeat` is derived from `prior_experience = sent`. (CONCEPT §7.4, D6, D14, D20)

**`discipline` and `protection` are one unit.** `protection = 'none'` *means* boulder, so
`(boulder, lead)` and `(sport, none)` are unrepresentable too — such a row would be counted in one
view and dropped in another rather than rejected.

**Flash rate = flashes ÷ first encounters**, where a first encounter is any tick with
`prior_experience = none` — *including* ones never sent. Dividing by sends is biased upward at
exactly the limit grade the metric exists to find. This is the one metric that deliberately does
*not* filter `is_send = true`. (CONCEPT §4.2, D14)

**Segment, never exclude.** Every metric breaks down by `protection` and by whether it was a flash,
rather than dropping auto-belay laps or toprope. No global ranking, no points system — comparison is
against your own past self. (CONCEPT §4.2, D6)

**No onsight anywhere.** Not hidden from the indoor UI — removed from the model with the rest of the
enum, because it turns on whether you had beta and nothing records that. Outdoor use is what would
bring it back, along with a stored `send_style`. (CONCEPT §6, D20)

**The tick carries no `venue_id`, `sector`, `attempts`, `high_point` or free-text `tags`.** Venue comes
through the session; the rest are `notes`, or gone. Route characteristics are typed: `angle` (one of
slab/vertical/overhang/roof) and `holds` (any of crimp/sloper/pinch/pocket/jug). They are descriptive,
not analytic — annotations live on a go while describing a climb, so any metric keyed on them would
skew toward sends. (D18, D19, D21)

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
  **Four surfaces, on a bottom tab bar:** logging (venue picker and end-of-session summary live
  inside it), the session list plus its per-session detail, the flash-rate chart, and settings
  (which is where export/import live). The session detail is not optional garnish — it is the only
  read path for the tick sheet's `notes`/`rating`/`grade_opinion`/`angle`/`holds`/`length_m`, which
  are otherwise write-only once the session closes.
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

**Routing is `@tanstack/react-router`, and TanStack is the lean for future client-side needs — but
`@tanstack/react-query` is not Phase 0** (D22). Do not propose `react-router`, and do not reach for
Query because the router is already here: Query manages *server* state, and CONCEPT §8.3 makes the
client the source of truth, so in a phase with no network a query cache would be a second copy of the
authority with nothing to reconcile against. Reactivity, if wanted, is `dexie-react-hooks` — it
observes IndexedDB, which *is* the authority. The `build-tooling` scope fence names server-state
libraries alongside HTTP and auth clients for this reason.

- **Routes are written by hand.** No `@tanstack/router-plugin`, no `routeTree.gen.ts` — generated code
  is committed here, so the file would enlist `codegen-check`, both hooks and CI for a tree of three
  routes.
- The route tree lives in `apps/web/src/router.tsx`; the shell is the root route's component in
  `Shell.tsx`, because `Link` needs router context and therefore every tappable part of the frame must
  render *inside* `RouterProvider`, not around it.
- **Address a route by its path string** (`useParams({ from: '/sessions/$sessionId' })`) rather than by
  importing the route object — the route tree imports the screen in order to render it, so importing
  back is a cycle. The string is no less checked: `Register` in `router.tsx` is what types it.
- **Tests render through `renderApp()`** (`src/testing/renderApp.tsx`), which awaits the router's first
  match. `RouterProvider` commits that match in an effect, so a synchronous `getBy*` straight after
  `render` sees an empty `<div />`.
- **`fileParallelism: false` in `vite.config.ts` is load-bearing, not cargo.** Three suites drive real
  screens against the one `db` singleton those screens import and each clears it; in parallel one
  file's `clear()` lands between another's seed and its assertion, flaking about a quarter of full
  runs. Costs 28s against 6s.

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