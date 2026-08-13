## 1. The correction write path

- [x] 1.1 Add `RopedTick` to `db/types.ts` — `TickBase & TickGrade & TickOutcome & Extract<TickDiscipline, { discipline: 'sport' | 'trad' }>` — with a comment stating that narrowing to it is `tick.protection !== 'none'`, the same test that decides whether a protection control renders
- [x] 1.2 Add `correctGrade(db, tick, raw, now?)` to `db/ticks.ts`: `db.transaction('rw', …)`, re-read by `tick.id`, pair the label with the **fresh row's** scale through the existing `gradeOf`, return `undefined` when it does not pair, otherwise `put` the whole row with `updated_at` bumped and return it
- [x] 1.3 Add `correctProtection(db, tick: RopedTick, protection: RopedProtection, now?)` the same way, guarding on the fresh row still being roped
- [x] 1.4 Add `correctOutcome(db, tick, outcome: TickOutcome, now?)` — unconstrained, all six combinations valid
- [x] 1.5 Confirm the union replacement typechecks with no `as Tick` anywhere; if `{ ...fresh, ...grade }` does not narrow, destructure the old pair out first as `logTick` does
- [x] 1.6 Document in `ticks.ts` why these are three narrow functions and why there is deliberately no `correctClimb` — the absence of the function is what forbids a cross-discipline correction
- [x] 1.7 Unit tests in `db/ticks.test.ts`: each correction writes the new value; `id`, `session_id`, `created_at`, `date_local` and `tz_offset` are unchanged; `updated_at` moves; all six annotation fields survive each of the three corrections
- [x] 1.8 Unit tests for the refusals: a French label against a Font tick is not written and the row is untouched; a boulder row reaching `correctProtection` is refused rather than written
- [x] 1.9 Unit test for the freshness guarantee: annotate a tick, then correct it from a snapshot taken **before** the annotation, and assert the annotation survives
- [x] 1.10 Extend `db/writes.assert.ts` with a correction section mirroring the `TickDraft` block — the three parameter types asserted against the invariants, plus controls proving valid corrections still reach them

## 2. The reusable controls

- [x] 2.1 Add `anchor?: number` to `GradeGrid`, separate from `range`: it sets the opening scroll position without dimming anything. Keep `range`'s meaning untouched so the logging path is unchanged
- [x] 2.2 Add `selected?: string` to `GradeGrid`, marking the current grade with `aria-pressed` and not by colour alone
- [x] 2.3 Add a `cancelLabel` prop to `OutcomeGrid` — "Change grade" is right on the logging screen and wrong in a sheet where cancelling returns to the detail panel
- [x] 2.4 Extract the protection toggle from `LoggingScreen` as a presentational `ProtectionGroup({ value, onChange })` and use it in both places. It keeps the target size and wording in one place; the logging screen keeps its own rules about when the group renders
- [x] 2.5 Tests: an anchored grid opens at the anchor and dims nothing; a ranged grid still dims and positions as before; `ProtectionGroup` renders the three roped values and never `none`

## 3. The sheet becomes the go sheet

- [x] 3.1 Move `components/annotation/` to `components/go/`, renaming `AnnotationSheet` → `GoSheet` and `useAnnotation` → `useGoSheet`. `AnnotationPanel` keeps its name — it really is the annotation panel
- [x] 3.2 Update the importing modules and their tests; no behaviour change in this group
- [x] 3.3 Run the full gate to confirm the rename is mechanical

## 4. Corrections in the go sheet

- [x] 4.1 Add a `mode` state to `GoSheet` — `'detail' | 'grade' | 'protection' | 'outcome'`
- [x] 4.2 Add the first line: grade verbatim, protection and outcome, each its own target, worded from `format/climbing.ts` (`protectionLabel`, `outcomeWord`) so no fourth vocabulary appears. Omit the protection chip entirely when `protection === 'none'`
- [x] 4.3 Render `GradeGrid` for `mode: 'grade'`, with the tick's own scale, `anchor` at its current grade, `selected` on it, and no `range`
- [x] 4.4 Render `ProtectionGroup` for `mode: 'protection'` and `OutcomeGrid` for `mode: 'outcome'`, each with a way back to `'detail'`
- [x] 4.5 Commit a value → call the matching `correct*`, show the corrected row, return to `'detail'`
- [x] 4.6 Tests: the first line states what was recorded; a boulder tick shows no protection chip; tapping a chip opens its control; committing writes and returns to the detail panel; the grade control renders only the tick's own notation
- [x] 4.7 Fake-timer test: a sheet opened by a write does not close itself while a correction control is open

## 5. The hook and both surfaces

- [x] 5.1 Add a correction path to `useGoSheet` that writes through and replaces `open.tick` with the returned row, preserving `reason` so the sheet does not remount
- [x] 5.2 Confirm neither caller's sheet key contains a field a correction changes — remounting would discard `mode` and `engaged`
- [x] 5.3 Wire `LoggingScreen`: a correction refreshes the recent-ticks list, as a write already does
- [x] 5.4 Wire `SessionDetailScreen`: a correction re-reads on dismiss, as an annotation already does — the row is behind the backdrop until then
- [x] 5.5 Screen test through `renderApp()`: correct a grade from the recent-ticks list of an open session; the list and the stored row both show it
- [x] 5.6 Screen test through `renderApp()`: correct a grade and an outcome from a **closed** session's detail view; the row's outcome mark and wording follow the new value
- [x] 5.7 Screen test: correcting one of several goes logged under the same wrong protection changes only that go
- [x] 5.8 Screen test: the sheet shows the corrected grade without being closed and reopened — the stale-snapshot regression

## 6. Documents

- [x] 6.1 Append `D23` to `CONCEPT.md`'s decision log: a written tick's grade, protection and outcome are correctable; correction never crosses a discipline; correction is per-tick. Record the Nekala case, why undo is not a substitute, and that closing the discipline gap waits on D17
- [x] 6.2 Add a line to `CLAUDE.md`'s invariants section: the three unions are corrected whole through the correction path, never patched through `annotateTick`, and a correction preserves `created_at`/`date_local`/`tz_offset`
- [x] 6.3 Update the `Last updated:` lines on any document touched
- [x] 6.4 Note for the archive sync: `openspec/specs/sessions-view/spec.md`'s **Purpose** paragraph claims "no editing of `prior_experience` or `is_send`". A delta spec cannot reach a Purpose section, so that sentence has to be corrected by hand when the specs are folded in

## 7. Verify

- [x] 7.1 `just check` clean — codegen-check, fmt-check, typecheck, lint, full test suite
- [x] 7.2 In a real browser at a phone viewport: log a go, correct its grade from the recent list, correct its protection, end the session, reopen it from Sessions and correct its outcome. Confirm each lands and each survives a reload
- [x] 7.3 In the browser, confirm the correcting grade grid opens at the tick's own grade with nothing dimmed, and that the logging grid's position is unaffected by the correction
- [x] 7.4 Confirm every target on the new first line meets the 48px floor with the sheet at a 412×600 viewport
- [x] 7.5 Read the stored row back (straight from IndexedDB — the settings/export surface is not built
  yet, so there is no export button to press) and confirm a corrected tick is one row with its original
  timestamps: `created_at` 18:41:05 against `updated_at` 18:44:20, `date_local` and `tz_offset`
  unchanged, twelve keys and no strays
