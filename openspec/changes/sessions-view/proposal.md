## Why

**Every optional detail the app collects is currently write-only.** `AnnotationSheet` gathers `notes`,
`rating`, `grade_opinion`, `angle`, `holds` and `length_m`, and the only read path is
`recentTicks(db, sessionId)` for the session that is still open. Close the session and all six fields
become unreachable except by exporting JSON and reading it by hand — a whole sheet, a modal backdrop
added to protect it, and roughly two hours of usable life per value.

Phase 0's exit criterion is that you log every session for a month and stop reaching for anything
else. A logbook you cannot read back does not meet it. `DESIGN.md` §6 names the session list as one of
Phase 0's five surfaces; `CONCEPT.md` §5's feature list omits it, which is the drift this change also
corrects.

## What Changes

- **A `Sessions` tab listing every closed session, newest first, plus the open one.** Each card gives
  the local date and start time, duration, tick count, venue, and the protections used — then **one
  pill per go**, reusing `SessionSummary`'s existing grade-plus-outcome pill rather than tallying by
  grade. Tallying `6b ×4` would discard the flash/fall distinction the model exists to record, which
  `summary.ts` already refuses to do; a card is a glance surface, so the tally is only honest when the
  per-go truth is one tap away, and here it is.
- **Pills group by `(discipline, grade_scale)` when a session spans more than one.** A visit that ropes
  and boulders at Kiipeilyareena Salmisaari produces French and Font grades whose labels differ only by
  letter case, so `6a` and `6A` would otherwise sit adjacent and unlabelled.
- **A session detail view**: every go in chronological order, with everything it carries — protection
  (or `boulder`, since `protection: 'none'` is what boulder means), prior experience in
  `RecentTicks`' existing vocabulary, then angle, holds, rating, grade opinion, length and notes
  where present. Bare goes collapse to one line, because most goes carry nothing.
- **Tapping a go reopens `AnnotationSheet`**, so detail can be corrected and not merely read. This
  matters most for `prior_experience`, which is flash rate's denominator and which a mis-tap corrupts
  silently.
- **`AnnotationSheet`'s countdown and heading become conditional on why it opened.** Both are wrong on
  a deliberate reopen: the copy claims "Logged 6a" for a go from three weeks ago, and `SHEET_IDLE_MS`
  exists to keep an *interruption* of the two-tap path cheap — there is no two-tap path to protect when
  the sheet was asked for. `LoggingScreen.handleReopen` already has both faults today; the detail view
  makes them unignorable.
- **A bottom tab bar carrying only the tabs that exist** — `Log` and `Sessions` now, with `Flash` and
  `Settings` joining as they ship. Bottom rather than top, per `DESIGN.md` §4's thumb-reach constraint.
- **TanStack Router**, replacing the `if (!session)` branching in `LoggingScreen` with real routes.
  `App.tsx` currently states there is no router "until a second one earns the dependency"; this is that
  second screen. Routes also give the installed PWA a working Android back button, which state-based
  tabs cannot.
- **The scope fence gains a named exclusion for server-state libraries.** A router is not a Phase 1
  concern; TanStack Query would be — Phase 0 has no network, and `CONCEPT.md` §8.3 makes Dexie the
  source of truth rather than a cache in front of one. Writing this down is the point: the fence
  should say which parts of the family are welcome now.
- **The lean toward TanStack is recorded outside this change folder** — as `CONCEPT.md` **D22** and a
  line in `CLAUDE.md`'s planned-UI-stack section. Both are needed for different reasons: the decision
  log is where a future session looks before proposing `react-router`, and `CLAUDE.md` is what is loaded
  into context unprompted. The delta spec above cannot do this job alone, because archiving folds the
  requirement into `openspec/specs/` while the *reasoning* leaves the live tree with the change folder.
- **No session deletion.** Undo stays session-scoped. A session logged at the wrong venue remains
  permanent in Phase 0, which is accepted rather than overlooked.
- **No volume metric.** The mock's `31 · 412 ticks · 3.9 km up` header loses the vertical metres:
  `venue.default_route_length_m` is seeded absent (§12 Q1), and §5 assigns volume metrics to Phase 1.
  Phase 0 ships exactly one analytic and it is flash rate.

## Capabilities

### New Capabilities

- `sessions-view`: the session list and the session detail view — what a card says, how goes are
  ordered and grouped, what a detail row shows, reopening the sheet from history, and the empty state.

### Modified Capabilities

- `app-shell`: navigation is new spec-level behaviour — a bottom tab bar showing only shipped tabs,
  named routes for each, and the back-button contract in an installed PWA. Its existing offline
  requirement gains a scenario for a deep link opened offline, which the service worker must answer
  rather than Cloudflare.
- `build-tooling`: the Phase 0 scope fence is strengthened to name server-state and data-fetching
  libraries as out of scope, and to state that a router is not.

## Impact

**Dependencies.** `@tanstack/react-router` in `apps/web`. Code-based routes rather than the file-based
plugin: two routes need no generated `routeTree.gen.ts`, and a generated file would enlist
`codegen-check` for nothing.

**Code.**

- `apps/web/src/App.tsx` — becomes the router shell plus the tab bar; the screen-selection branching
  leaves `LoggingScreen`.
- `apps/web/src/features/logging/LoggingScreen.tsx` — the `annotating`/`annotation` state and its
  write path move out to be shared with the detail view. The file's own comment predicts this: "When a
  second screen arrives, this is the thing to extract."
- `apps/web/src/features/logging/SessionSummary.tsx` — `OutcomeIcon` and `outcomeOf` extract to a
  shared pill. A module exporting both a component and plain helpers loses fast refresh, which is why
  `summary.ts` exists; the split follows that precedent.
- `apps/web/src/features/logging/AnnotationSheet.tsx` — countdown and heading become conditional.
- `apps/web/src/db/sessions.ts` — a history query. Dexie has no joins, so this is the two-step read
  D19 accepted: sessions, then their ticks grouped by `session_id`.

**Documents.** `CONCEPT.md` gains decision **D22** (the TanStack lean and its Phase 0 boundary) and
loses the §5 drift that started this: its Phase 0 feature list names neither the session list nor the
settings screen, while `DESIGN.md` §6 lists both as Phase 0 surfaces. `CLAUDE.md`'s planned-UI-stack
section gains the router. Both files' `Last updated:` lines move.

**Layout, and it must be measured.** A tab bar takes roughly 56 px from a shell that is already bounded
to the viewport so the grade grid can scroll, against a `min-h-40` floor. Reasoning about this layout
was wrong three times in a row last week while Chromium was right immediately, so the grid gets
re-measured at 412×600 rather than argued about. If it squeezes, the shell header is the thing to
reclaim — the mock's logging screen has no logo and no theme switch, and a theme switch belongs in
Settings.

**Not affected.** `web-deployment` already carries a "Client-side routes resolve" requirement, and
`apps/web/public/_redirects` already serves the shell for unmatched paths with the `404.html` trap
documented. The online half of deep linking is done.
