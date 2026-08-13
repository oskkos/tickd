## Why

The first real test session produced two wrong rows that cannot be repaired. A grade cell was mis-tapped,
and a stale sticky `protection` recorded several toprope laps as lead — noticed mid-session, by which point
undoing them would have meant deleting from the middle of the evening and re-logging at the end, losing the
sequence the session detail exists to show. The grade error was noticed only after the session closed, where
there is no repair path at all.

Everything a tick carries is already editable *except* the three things that are paired unions: its grade,
its discipline-and-protection, and its outcome. `annotateTick` reaches the six loose fields precisely
because a partial of a discriminated union is unsound, and `sessions-view` states that gap in writing
rather than implying it away. This change closes it for the two fields that were actually misentered, plus
the outcome — which the same spec already names the worst of the three, because `prior_experience` is flash
rate's denominator and a phantom first encounter inflates the metric at exactly the grade it exists to find.

## What Changes

- **A written tick's grade, protection and outcome become correctable**, from both surfaces that already
  show a tick: the recent-ticks list of an open session, and a closed session's detail view. One shared
  sheet, so one implementation serves both.
- **The annotation sheet becomes the go sheet.** Its first line stops being a heading and becomes what was
  recorded — grade, protection, outcome — with each part tappable to correct it. The optional-detail panel
  below is unchanged. The sheet's reopened heading already reads *"6a. Anything to change?"*; this is what
  makes that copy true.
- **A new write path, `correctTick`**, replacing whole unions via `put` rather than patching them via
  `update`. It preserves the tick's identity, its `created_at`, its `date_local`, its `tz_offset` and every
  annotation field. Editing a tick never moves the day it was climbed — that is what separates a correction
  from a re-log.
- **Cross-discipline correction is forbidden**, and the limitation is recorded rather than hidden. A roped
  tick's protection may move within `lead`/`toprope`/`autobelay`; a boulder tick's `protection: 'none'` is
  not a choice and gets no control, exactly as on the logging screen. A grade may be re-picked only from the
  scale the tick already carries.
- **Correction is per-tick.** No bulk edit, no "apply to the rest of the session".
- Type-level assertions in `writes.assert.ts` gain a correction section, mirroring what already exists for
  `TickDraft`, so re-decoupling either pair at the new write path is a compile error.

Not in scope: deleting from history (undo stays session-scoped), moving a tick to another session or venue,
and any change to how a tick is first written. The two-tap logging path is untouched.

## Capabilities

### New Capabilities

None. Correction is new behaviour on an existing surface, not a new surface: the sheet belongs to
`tick-logging`, the detail view that reuses it belongs to `sessions-view`, and the write path belongs to
`local-database`. Giving it its own capability would put the rules in a fourth file while both existing
capabilities still needed their "not editable" claims retracted.

### Modified Capabilities

- `tick-logging`: adds what is correctable on a written tick, what is deliberately not, and how the go sheet
  presents it. Its existing "Optional detail annotates an existing tick" requirement is left standing —
  annotation is unchanged — but the sheet it describes now carries more than annotation.
- `sessions-view`: its "Tapping a go reopens the annotation sheet" requirement currently states that
  `prior_experience` and `is_send` are **not** editable and calls that a real gap. That carve-out is
  retracted and replaced with corrections being reachable from the detail view, with the cross-discipline
  limitation stated in its place.
- `local-database`: adds the correction write path's requirements — whole unions rather than partials,
  identity and timestamps and annotations preserved, and the invariants holding at this write path as they
  already must at the logging one.

## Impact

**Code**

- `apps/web/src/db/ticks.ts` — new `TickCorrection` type and `correctTick` function beside `logTick` and
  `annotateTick`.
- `apps/web/src/db/writes.assert.ts` — assertions against `TickCorrection`.
- `apps/web/src/components/annotation/` — the sheet grows a correction header; `useAnnotation` gains a
  correction path and must refresh the `open.tick` snapshot it holds, which is currently never refreshed
  because nothing the sheet edits was previously displayed by the sheet.
- `apps/web/src/features/logging/GradeGrid.tsx`, `OutcomeGrid.tsx` — reused, ideally unchanged. `OutcomeGrid`
  sets both outcome fields in one tap, which is why the outcome is corrected whole rather than
  `prior_experience` alone.
- `apps/web/src/features/logging/LoggingScreen.tsx`, `features/sessions/SessionDetailScreen.tsx` — both
  re-read after a correction, as they already do after an annotation.

**Not affected**

- The working range does not recompute on a correction, for the same reason it does not on a log: the grid
  must not move under a thumb that is about to tap it.
- No schema change, no new table, no new index, no Dexie version bump — corrections write the same row shape
  the logging path already writes.
- The flash-rate screen does not exist yet; when it does it reads corrected rows with no special handling.
