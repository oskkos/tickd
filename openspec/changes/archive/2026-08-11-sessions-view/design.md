## Context

Phase 0 has one screen and no router — `App.tsx` says so explicitly, and defers the dependency "until a
second one earns the dependency". This is that second screen, and it arrives carrying two things beyond
itself: navigation, and the first read path for annotations written since `logging-flow` shipped.

The current state that matters:

- `LoggingScreen` owns all screen selection through `if (session && ending)` / `if (!session)` branches,
  and owns the `annotating` / `annotation` state that drives `AnnotationSheet`.
- `SessionSummary` already renders exactly the pill this change wants on a session card — grade plus
  outcome mark — but `OutcomeIcon` and `outcomeOf` are private to that module.
- The shell is bounded to the viewport (`h-dvh`, `overflow-hidden`) so the grade grid can scroll inside
  a `min-h-40` floor. That bounding was hard-won and is the thing new chrome can break.
- `apps/web/public/_redirects` and the `web-deployment` spec already anticipate client-side routes.
- Dexie has no joins. `sessions: 'id, venue_id, date_local'` and `ticks: 'id, session_id, …'` — so
  history is a two-step read, which D19 accepted as this design's cost.

## Goals / Non-Goals

**Goals:**

- Make every annotation readable and correctable after the session that produced it closed.
- Give Phase 0 its navigation shape once, so `Flash` and `Settings` land into an existing bar rather
  than each renegotiating it.
- Adopt TanStack Router as the first deliberate step into the TanStack family, with the boundary of
  that adoption written down rather than left to drift.
- Keep the logging screen's measured layout intact.

**Non-Goals:**

- Deleting sessions or ticks from history. Undo stays session-scoped.
- Any analytic on this surface. Flash rate is its own screen; volume metrics are Phase 1.
- Search, filtering, or date-range selection over history. Thirty-one sessions do not need it, and
  building it now would be designing for a Phase 1 data volume.
- TanStack Query, Table, or Form. See D3 below.
- A route for the annotation sheet. It is a sheet over a surface, not a surface.

## Decisions

### D1 — TanStack Router, code-based routes, no file-based plugin

**Chosen:** `@tanstack/react-router` with routes declared in TypeScript.

The alternative that nearly won was no router at all: a `useState` tab plus a hand-rolled `popstate`
listener, about twenty lines and no dependency. It was rejected on two counts. The smaller is that
hand-rolled history integration is a known source of subtle bugs — double entries, back stacks that
grow per tap — and getting it wrong is invisible in tests and obvious in the hand. The larger is that
this is a deliberate first step into TanStack, so the dependency is the point rather than the cost.

`react-router` was the other candidate and is the more conventional buy. TanStack Router wins on
type-safe params — the session detail route carries a session id, and a typed param means the id cannot
be read as the wrong shape — and on being the family the project intends to grow into.

**File-based routing is declined.** It requires `@tanstack/router-plugin` and produces a committed
`routeTree.gen.ts`, which would enlist `codegen-check`, the pre-commit hook and CI for a tree of three
routes. The repository's convention is that generated code *is* committed, so the file would have to be
— which makes the cheap option the one that generates nothing.

### D2 — Routes are `/` and `/sessions` and `/sessions/$sessionId`

`/` stays the Log tab, so the manifest's `start_url` and every existing install keep working unchanged.

The session detail is a child route with the id as a param rather than a modal over the list. It is a
full surface with its own scroll and its own back target, and a route makes the back gesture work
without a second mechanism.

**Session selection stays in the database, not in the URL.** The Log tab does not encode which session
is open; `openSession(db)` remains the authority. Two sources of truth for "which session am I logging
into" is exactly the class of bug `startSession`'s transaction was added to fix.

### D3 — Router now; Query, Table and Form are not Phase 0

Adopting the router is not adopting the family wholesale, and the reason is specific rather than
cautious. `CONCEPT.md` §8.3 makes the client the source of truth: Dexie serves every read directly,
and in Phase 0 there is no network at all. TanStack Query manages *server* state — a cache in front of
an authority that lives elsewhere. Here there is no elsewhere, so a query cache would be a second copy
of the authority with nothing to reconcile against, and its invalidation model would be solving a
problem the architecture does not have.

Reactivity, where it is wanted, is `dexie-react-hooks` — it observes IndexedDB directly, which is the
authority, so a write is reflected without an invalidation step.

This is recorded as a numbered decision in `CONCEPT.md` (D22) rather than only here, because the
archive would otherwise take the reasoning out of the live tree with it, and "we already use TanStack
Router, so Query is the obvious next step" is precisely the inference a future session would make.

Phase 1 is where Query earns its place: a real backend, an outbox, a pull cursor, `401` handling.

### D4 — Extract the sheet's state to a hook, not a context or a store

`LoggingScreen` currently owns `annotating`, `annotation`, `handleAnnotate` and `handleReopen`. The
detail view needs the same four. A `useAnnotation(onWritten)` hook returning the sheet's state and its
handlers keeps the state co-located with each screen that uses it, so two screens cannot fight over one
value.

A context or a store was considered and rejected: there is no shared state between the tabs — the two
sheets never coexist, because opening the detail view means leaving the logging route.

### D5 — The sheet's countdown becomes a `reason` prop, not a boolean

`AnnotationSheet` gains `reason: 'logged' | 'reopened'` rather than `autoClose?: boolean`. The heading
and the countdown are two expressions of the same fact — whether this sheet followed a write — and a
boolean per behaviour would let them disagree, producing "Logged 6a" with no countdown or a countdown
under a neutral heading. One cause, one prop.

This also fixes the existing reopen path from `RecentTicks`, which today shows both a false "Logged"
and a countdown on a deliberate tap.

### D6 — One read for history, grouped in memory

`sessions.toArray()` and `ticks.toArray()`, grouped by `session_id` in a `Map`. Not a per-session query
per card: thirty-one sessions would be thirty-two round trips for a few hundred rows.

Ordering is done in memory too, on `started_at`, which is not indexed. `lastVenueId` already sets this
precedent and states why — an index existing only to order one screen would be a schema change for
nothing, and Phase 0's row counts are trivial.

### D7 — The pill is a component; ordering and grouping are pure functions

`GoPill` moves to its own module, used by `SessionSummary` and the session card. `outcomeOf` joins
`summary.ts`, which exists precisely because a module exporting both a component and plain helpers
loses fast refresh.

Grouping by `(discipline, grade_scale)` is a pure function over ticks, tested directly, because it is
the place the Font/French invariant is enforced on this surface and a component test would assert it
through the DOM.

### D8 — The tab bar lives in the router's root route, measured before it is believed

The bar renders once in the root layout rather than per screen, so it cannot desynchronise from the
active route.

**Its space cost is measured in Chromium at 412×600, not reasoned about.** Reasoning about this exact
layout was wrong three times consecutively during `logging-flow` — page-scrolls-instead-of-grid,
grid-squeezed-to-one-row, rows-clipped-off-screen — and each time a real measurement was right
immediately. jsdom reports every height as 0, so the test suite cannot answer this question.

If the grid falls below its floor, the reclaim order is: the shell's `ThemeSwitch` (it belongs in
Settings, and the mock's logging screen has no theme control), then the shell's logo header (the mock
makes the venue the heading). Both are deferred until a measurement says they are needed.

## Risks / Trade-offs

**The tab bar squeezes the grade grid below its floor** → Measured at 412×600 before the change is
called done, with the reclaim order in D8 ready. This is the most likely thing to go wrong.

**An offline deep link fails because the service worker has no navigation fallback** → `vite-plugin-pwa`
may or may not configure `navigateFallback` by default for this setup; the version in use is not
assumed. Verified explicitly against a built preview with the network disabled, and configured if
absent.

**A route change loses the pending grade mid-log** → Switching tabs with a grade picked but no outcome
committed discards the pending tap. That is correct — nothing is written until the outcome — but it
must not throw or leave the screen in a half state. Covered by remounting: `pendingGrade` lives in
`LoggingScreen`, which unmounts with the route.

**The sheet opened from history writes to a tick whose session is closed** → `annotateTick` does not
care, and should not: annotation has never been gated on the session being open. Worth stating because
it looks like it should be a special case and is not.

**Per-go pills make a busy card tall** → An eighteen-go session runs about four wrapped rows, so roughly
two cards fit a screen where a tallied version would fit three and a half. Accepted: the tally would
discard the flash/fall distinction, and the list is scrollable.

**TanStack Router's bundle cost is paid up-front by the precache** → The service worker precaches
everything before first use, so this is install weight rather than per-visit weight. Measured against
the built output rather than quoted from memory.

## Open Questions

- Whether `dexie-react-hooks` should come in with this change to make the Sessions list live, or
  whether a one-shot read on mount is enough. A one-shot read is enough for correctness — nothing
  mutates history while the list is showing except the sheet, which can refresh explicitly — so the
  default is not to add it, and to revisit if the explicit refreshes multiply.
- Whether the shell's `ThemeSwitch` moves to Settings now or when Settings ships. Deferred to the
  measurement in D8: if the grid holds, the switch stays where it is.
