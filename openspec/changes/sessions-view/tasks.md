## 1. The router and the tab bar

- [x] 1.1 Add `@tanstack/react-router` to `apps/web` dependencies. Do **not** add
  `@tanstack/router-plugin` — routes are hand-written (design D1, and the `build-tooling` delta forbids
  a generated route tree)
- [x] 1.2 Declare the route tree in code: a root route holding the shell, `/` for Log, `/sessions` for
  the list, `/sessions/$sessionId` for the detail. `/` stays the Log route so the manifest's `start_url`
  and existing installs keep working
- [x] 1.3 Move screen selection out of `LoggingScreen` into the routes. The `session && ending` summary
  branch stays inside the Log route — ending a session is a step in logging, not a destination
- [x] 1.4 Build the `TabBar` component in the root route: fixed to the bottom, one tab per shipped
  surface (`Log`, `Sessions`), no placeholder entries for `Flash` or `Settings`. Current tab marked by
  more than colour, targets at least 48 px
- [x] 1.5 Keep the shell's `h-dvh` / `overflow-hidden` bounding intact and give the tab bar `shrink-0`,
  so it takes space from `main` rather than overflowing it
- [x] 1.6 Tests: the bar renders exactly the shipped tabs and no disabled ones; the current tab is
  marked; navigating to `/sessions` and back leaves the Log route intact
- [x] 1.7 Update `apps/web/src/App.tsx`'s doc comment — it currently states there is no router and why

## 2. Reading history out of the database

- [x] 2.1 Add a history read to `apps/web/src/db/sessions.ts`: all sessions plus their ticks, in one
  pass each, grouped by `session_id` in a `Map` (design D6 — not a query per card)
- [x] 2.2 Order sessions by `started_at` descending in memory, with the open one first. Follow
  `lastVenueId`'s precedent and its stated reason for not adding an index
- [x] 2.3 Add a `sessionById` read for the detail route, returning the session, its venue and its ticks
  ordered by `created_at` ascending
- [x] 2.4 Add the pure grouping function: ticks → groups keyed by `(discipline, grade_scale)`, in
  first-appearance order, returning a single ungrouped run when there is only one pair
- [x] 2.5 Tests: a discarded session yields no row; the open session sorts first; a mixed-scale session
  splits into two groups and a single-scale one does not; a session at a venue grading both disciplines
  in French still splits by discipline

## 3. The shared go pill

- [x] 3.1 Extract `OutcomeIcon` from `SessionSummary.tsx` into its own module, and move `outcomeOf` into
  **`db/style.ts`** rather than `summary.ts` as originally written — it belongs with `sendStyleOf` and
  `isFlash`, and putting it in a `features/logging` module would make the sessions feature import from
  the logging one for a derivation neither owns
- [x] 3.2 Extract the pill markup itself as `GoPill`: grade verbatim plus outcome mark, with the
  accessible label `SessionSummary` already builds
- [x] 3.3 Rewire `SessionSummary` to use `GoPill`, changing nothing it renders
- [x] 3.4 Tests: the existing `SessionSummary` suite still passes unchanged; a flash and a send render
  distinct marks; grade text is not case-transformed

## 4. The session list

- [x] 4.1 Build `SessionsScreen` at `/sessions`: cards newest first, the open session first and visibly
  marked as running
- [x] 4.2 Card header: local date, start time, duration, tick count, venue name, and the protections its
  ticks used. No vertical metres, no flash rate, no analytic of any kind
- [x] 4.3 Card body: one `GoPill` per go in the order they happened, grouped and labelled by
  `(discipline, notation)` only when the session spans more than one pair
- [x] 4.4 The open session's duration runs to the present moment; a closed one's from its stored
  timestamps, unqualified — no marker distinguishing an explicit end from a lazy close, because nothing
  records which happened
- [x] 4.5 Tapping a closed card routes to its detail; tapping the open card routes to Log
- [x] 4.6 Empty state: what will appear there, plus a route to start a session
- [x] 4.7 Tests: two goes at one grade with different outcomes render two distinct pills, never `×2`;
  two sessions on one local date are told apart by start time; no vertical-distance text appears
  anywhere on the screen; the empty state renders with an empty database

## 5. The sheet, opened deliberately

- [x] 5.1 Give `AnnotationSheet` a `reason: 'logged' | 'reopened'` prop (design D5 — one cause, one
  prop, so the heading and the countdown cannot disagree). `'reopened'` shows no countdown and no
  "Logged" heading
- [x] 5.2 Rewrite the sheet's doc comment: `SHEET_IDLE_MS` exists to keep an *interruption* of the
  two-tap path cheap, which is why a deliberately opened sheet has nothing to count down to
- [x] 5.3 Extract `LoggingScreen`'s `annotating` / `annotation` state and its write path into a
  `useAnnotation` hook taking an "after write" callback — the file's own comment predicts this
  extraction
- [x] 5.4 Pass `reason: 'reopened'` from `LoggingScreen.handleReopen`, fixing the existing fault where
  tapping a recent tick shows a false "Logged" and starts a countdown
- [x] 5.5 Tests: a sheet opened after a write closes itself and shows a countdown; one opened by
  reopening does neither and its heading does not claim a fresh write

## 6. The session detail

- [x] 6.1 Build `SessionDetailScreen` at `/sessions/$sessionId`: venue, local date, start and end times,
  duration, and counts of ticks, sends and flashes
- [x] 6.2 List every go by `created_at` ascending — interleaved across disciplines, not sectioned
  (design and spec: the detail is the session's sequence)
- [x] 6.3 Row line one always: time, grade verbatim, outcome mark, then the protection for a roped go or
  the word `boulder` when protection is `none`, then prior experience in `RecentTicks`' existing
  vocabulary
- [x] 6.4 Row remainder, each omitted when absent: angle and holds; rating, grade opinion and length;
  notes. A go carrying none of them collapses to one line
- [x] 6.5 Tapping a go opens the annotation sheet with `reason: 'reopened'`, seeded from the tick;
  writing refreshes the list in place
- [x] 6.6 No delete control anywhere on this screen or the list
- [x] 6.7 Tests: goes appear oldest first; a bare go renders one line; a fully annotated go shows all
  six fields; a boulder row reads `boulder` and shows no protection; editing prior experience on a go in
  a closed session persists; neither history screen exposes a delete affordance

## 7. The documents

- [x] 7.1 Append `CONCEPT.md` **D22** — TanStack Router adopted in Phase 0; the family is the default
  lean for future client-side needs; Query, Table and Form are not Phase 0, with §8.3's client-is-the-
  source-of-truth reasoning stated rather than referenced
- [x] 7.2 Fix the `CONCEPT.md` §5 drift: its Phase 0 feature list names neither the session list nor the
  settings screen, while `DESIGN.md` §6 lists both as Phase 0 surfaces. Add them, since CONCEPT owns
  *what*
- [x] 7.3 Add the router to `CLAUDE.md`'s planned-UI-stack section, with the Query boundary — this is the
  file loaded into context unprompted, so it is what stops a future session reaching for `react-router`
  or adding Query
- [x] 7.4 Update the `Last updated:` line in `CONCEPT.md`, and `DESIGN.md`'s if it is touched

## 8. Verify

- [ ] 8.1 **Measure the logging screen in Chromium at 412×600 with the tab bar rendered.** Confirm the
  grade grid shows at least three rows, scrolls within its own bounds, and that the page itself does
  not scroll. Reasoning about this layout was wrong three times during `logging-flow`; measurement was
  right every time
- [ ] 8.2 If the grid falls below its floor, apply design D8's reclaim order — `ThemeSwitch` to Settings
  first, then the logo header — and re-measure rather than adjusting the floor
- [ ] 8.3 Verify an offline deep link: build, preview, load `/sessions` with the network disabled after
  one online visit. Configure `workbox.navigateFallback` if `vite-plugin-pwa`'s default does not already
  cover it — do not assume either way
- [ ] 8.4 Verify the back gesture in an installed PWA on Android: Sessions → back returns to Log without
  dismissing the app; detail → back returns to the list
- [ ] 8.5 Confirm the scope fence still holds: `apps/web/package.json` has no HTTP, auth, sync or
  server-state dependency, and no generated route tree or route plugin exists
- [ ] 8.6 Plant-verify the new guards one at a time — break the grouping function so a mixed session
  renders one run, drop the `reason` prop's effect, tally the pills — confirming each fails exactly its
  own test, then restore. One plant at a time; batching produces collateral that proves nothing
- [ ] 8.7 `just check` green, and record the test count
