## Context

A tick is four groups of fields: identity and timing (`id`, `session_id`, `created_at`, `date_local`,
`tz_offset`), six loose annotation fields, and three paired unions — `TickGrade`, `TickDiscipline`,
`TickOutcome`. Only the annotation fields are writable after the tick is created, through
`annotateTick` → `db.ticks.update(id, partial)`. The unions are excluded deliberately: a partial of a
discriminated union is unsound, so `update` cannot safely touch them.

Two surfaces already show a tick and already open the same sheet for it — `RecentTicks` in the open
session and `SessionDetailScreen` for a closed one — via `useAnnotation`, a hook extracted for exactly
this reason. So the work is one new write path plus one new region inside a sheet that both surfaces
already mount.

Constraints from the repo that shape this:

- **No migrations, ever, in Phase 0.** A row written wrong is permanent, so the guards have to be
  compile-time wherever they can be.
- **Every tap persists immediately.** No draft state, no confirm step.
- **`writes.assert.ts` asserts against accepting parameter types**, not row shapes, because that is the
  distinction a previous defect turned on.
- **Two-tap logging is a requirement in every case**, so nothing on the fast path may gain a tap.

## Goals / Non-Goals

**Goals:**

- Correct a written tick's grade, protection and outcome from either surface that shows it.
- Make the impossible corrections *unrepresentable* rather than validated where the type system can reach:
  no cross-scale grade, no cross-discipline protection.
- Preserve the row's identity, its place in time, and its annotations across a correction — the whole-row
  write is the risk, and it is where the tests point.
- Reuse `GradeGrid` and `OutcomeGrid` rather than build second controls with a second vocabulary.

**Non-Goals:**

- Changing a tick's discipline, or its `grade_scale`.
- Deleting from history, or moving a tick between sessions or venues.
- Bulk correction of several goes.
- Making a non-default protection more visible while logging. That attacks the cause of one of the two
  reported errors and is a better change than a bigger version of this one, but it is a different change.
- Any schema change. No new table, no new field, no Dexie version bump.

## Decisions

### Three narrow correction functions, not one general one

A single `correctTick(db, id, { grade, climb, outcome })` would have to accept all three parts and then
police two relationships at runtime: that the grade's scale matches the row's, and that the discipline
does not move. Both are expressible in the type system if the functions are split, and the codebase's
standing position is that a silently-failing invariant must be a compile error rather than a check.

```
correctGrade(db, tick, raw)             raw: string → gradeOf(raw, fresh.grade_scale)
                                        the scale is READ from the row, never supplied

correctProtection(db, tick, protection) tick: RopedTick, protection: RopedProtection
                                        boulder ticks are a compile error at the call site
                                        `discipline` never appears, so it cannot move

correctOutcome(db, tick, outcome)       outcome: TickOutcome — unconstrained, all six valid
```

`RopedTick` is `TickBase & TickGrade & TickOutcome & Extract<TickDiscipline, { discipline: 'sport' | 'trad' }>`.
Narrowing to it is `tick.protection !== 'none'`, which is the same test the sheet needs in order to decide
whether to render a protection control at all — one check doing both jobs.

There is deliberately **no `correctClimb`**. The absence of a function is the enforcement of "correction
never crosses a discipline"; a function that took a `TickDiscipline` would make the wrong correction
expressible and then need to reject it.

`correctGrade` reuses `gradeOf`, the existing boundary that turns a DOM string into a `TickGrade` or
nothing. Rejected alternative: a `correctGrade` taking a pre-paired `TickGrade`. It reads better but moves
the pairing decision to the caller, and the caller is a click handler with no proof of which grid rendered
the label — the same hole `gradeOf` was written to close.

### Read fresh inside a transaction; the caller's row proves intent, not currency

Each function takes the tick the caller is holding but writes from a row re-read by `tick.id` inside
`db.transaction('rw', …)`:

```
correctX(db, tick, value)
  └─ transaction rw
       fresh = db.ticks.get(tick.id)          ← authority
       guard on fresh (scale / protection)     ← guard, not a case
       db.ticks.put({ ...fresh, <union> , updated_at: now })
       return the written row
```

The snapshot cannot be trusted, and not hypothetically: the annotation panel writes to the same row
through `update` while the sheet is open, once per keystroke. A `put` built from a snapshot taken before
a note was typed would erase the note — data loss caused by the correction feature, in the one field with
no other copy. Reading fresh inside the transaction removes the window entirely.

The typed parameter still earns its place: it makes the call site prove roped-ness at compile time, while
the re-read makes the write correct. The runtime re-check on `fresh` is then a guard rather than a case,
which is how `LoggingScreen` already treats `gradeOf` returning `undefined`.

Returning the written row is not a convenience — see the snapshot decision below.

### The row is rebuilt by replacing a whole union, and `writes.assert.ts` is the arbiter

The intended form is `{ ...fresh, ...grade }`, which replaces `grade_scale` and `grade_raw` together.
Whether TypeScript distributes that spread over `Tick`'s union cleanly enough to stay assignable to `Tick`
is a question about the compiler, not about the design; if it does not, the fallback is the technique
`logTick` already uses — destructure the old pair out and add the new one, so no cast is needed:

```ts
const { grade_scale: _s, grade_raw: _r, ...rest } = fresh;
await db.ticks.put({ ...rest, ...grade });
```

Either way there is **no `as Tick`** anywhere in the path. A cast here is the exact defect
`local-database`'s write-path requirement was written about: it would walk past every assertion in the
suite while compiling cleanly. The new assertions in `writes.assert.ts` point at the correction
functions' parameter types, mirroring the existing `TickDraft` block.

### The sheet grows a mode, and is renamed to what it is

`AnnotationSheet` becomes `GoSheet` in `components/go/`, alongside `useGoSheet` (was `useAnnotation`) and
the unchanged `AnnotationPanel` — which keeps its name because it really is the annotation panel. The
specs now call this the go sheet; leaving the file named for the smaller job it used to do makes the next
reader unpick the difference. The rename is mechanical: four importing modules and their test files.

The sheet holds one new piece of state:

```
mode: 'detail' | 'grade' | 'protection' | 'outcome'

┌──────────────────────────────────────┐        ┌──────────────────────────────────────┐
│ 6a  ·  lead  ·  flashed     [Done]   │  tap   │ 6a  ·  lead  ·  flashed     [Done]   │
├──────────────────────────────────────┤ grade  ├──────────────────────────────────────┤
│ ANGLE  slab vertical overhang roof   │  ───▶  │  ┌────┬────┬────┐         [Back]     │
│ HOLDS  crimp sloper pinch pocket jug │        │  │ 6a │6a+ │ 6b │  ← opens at 6a     │
│ …                                    │        │  └────┴────┴────┘                    │
└──────────────────────────────────────┘        └──────────────────────────────────────┘
       mode: 'detail'                                   mode: 'grade'
```

Committing a value writes, updates the displayed row, and returns to `'detail'`. The three chips are the
only new affordance, so the fast path is untouched: a climber with nothing to correct sees one extra line
of text they already wanted (what was recorded) and no extra control.

The chips read their words from `format/climbing.ts` — `protectionLabel`, `outcomeWord`, and the grade
verbatim — because `sessions-view` already requires one vocabulary across surfaces, and a fourth phrasing
of "toprope" would be the thing that module exists to prevent.

Rejected alternative: a separate route, `/sessions/$sessionId/ticks/$tickId`. Deep-linkable and it gets
the back gesture for free, but it does not serve `RecentTicks` without navigating away from the open
session mid-log, and it would put a correction behind a screen transition rather than a tap.

### The sheet's row snapshot must be refreshed, and the key must not change

`useAnnotation` holds `open.tick` and never refreshes it. That is currently harmless because the only
field the sheet displays — `tick.grade_raw` in its heading — has been immutable. The moment grade is
correctable, the same code shows the old grade above a grid that just changed it.

So `correctX` returns the written row and the hook does `setOpen({ tick: written, reason })`. Two
constraints on that:

- **`reason` is preserved.** Both callers key the sheet on `${tick.id}:${reason}`, so changing `reason`
  would remount and reset `engaged` — restarting a retired countdown under a form in use, which is the
  bug that made the key two-part in the first place.
- **The grade must stay out of the key.** Keying on anything a correction changes would remount the sheet
  on every correction, discarding `mode` and `engaged` — the grid would vanish mid-correction and the
  countdown would come back.

The surfaces behind the sheet keep their existing refresh behaviour: `LoggingScreen` refreshes its list on
write, `SessionDetailScreen` re-reads on dismiss. The row being corrected is behind the backdrop, so its
staleness is invisible until the sheet closes, which is exactly when the re-read happens — the same
argument that removed the per-keystroke re-read from the detail screen.

### `GradeGrid` gains an anchor, distinct from its range

The grid positions itself at `range.from` and dims everything outside `[range.from, range.to]`. Passing
`{ from: i, to: i }` to open at the current grade would therefore dim 26 of 27 cells, which on a phone
reads as "disabled" — the same misreading that made day-one render every cell at half opacity, and the
reason the `?? Infinity` fallback was removed.

So the two concerns get separate props: `anchor?: number` for where to open, `range` unchanged for what to
emphasise. Correction passes an anchor and no range: nothing is dimmed, and the grid opens at the grade
being corrected, which is where a mis-tap's intended cell almost always is. A `selected?: string` prop
marks the current grade so the grid shows where you are.

Both are additive and optional; the logging path passes neither and behaves exactly as before, so the
existing positioning scenarios still hold.

### `OutcomeGrid` needs a label, and the protection control wants extracting

`OutcomeGrid`'s cancel button is hard-coded to "Change grade", which is right on the logging screen and
wrong in a sheet where cancelling means going back to the detail panel. It takes a `cancelLabel` prop
rather than a second component.

The protection control is currently eight lines inline in `LoggingScreen`. Extract it as a presentational
`ProtectionGroup({ value, onChange })` used by both, so the correction control and the logging toggle
cannot drift in wording or target size. Purely presentational — the logging screen keeps its own rules
about when the group is shown and whether it stays live mid-pending.

## Risks / Trade-offs

**The whole-row `put` drops any field not carried across** → The transaction reads the row it is about to
write, so there is no snapshot to be missing fields. A test asserts all six annotation fields plus
`created_at`, `date_local`, `tz_offset`, `id` and `session_id` survive each of the three corrections. This
is the highest-consequence failure in the change and it fails silently, so it gets explicit coverage rather
than an incidental assertion.

**A wrong discipline stays permanently wrong** → Accepted and recorded in both specs. Narrowed already by
the logging screen re-seeding its discipline from the session's newest tick; worst at Nekala, where both
disciplines are French and the grid's labels are identical either way. Closing it means a forced grade
re-pick on the new scale, deferred with D17's conversion table.

**Several goes under one stale protection still need N corrections** → Accepted; per-tick was chosen
deliberately. A bulk control has to guess which goes it covers and would turn one wrong field into several
when it guessed wrong.

**Spread-over-union may not typecheck as hoped** → Fallback stated above; `writes.assert.ts` decides
whether whatever lands is sound, and no cast is permitted either way.

**The countdown could close a sheet mid-correction** → Opening a correction control requires a
`pointerdown` inside the sheet, which already retires the countdown for good. Covered by a fake-timer test
rather than left to the argument.

**Renaming the sheet touches five modules** → Mechanical, no behaviour, one commit of its own. Skippable
if it turns noisy, at the cost of a file whose name understates what it does.

**Test flake from shared `db`** → `fileParallelism: false` is already set in `vite.config.ts` for exactly
this reason; new screen suites drive the same singleton and inherit the fix.

## Open Questions

- Should the go sheet's first line show the outcome as words (`flashed`), the icon `OutcomeIcon` draws
  elsewhere, or both? The rows in both surfaces pair the icon with an `sr-only` word; the chip has more
  room and is a control rather than a label, so it likely wants the visible word. Settle it while building.
- Does `{ ...fresh, ...grade }` narrow to `Tick`? Answered by the compiler in the first task group, with
  the destructure fallback ready.
