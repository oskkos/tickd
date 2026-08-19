## 1. The aggregation

- [x] 1.1 Add `db/flashRate.ts` exporting `FlashRateRow { label, encounters, flashes }`, `FlashRateGroup { discipline, scale, protection, rows }` and `flashRates(db)`. Rows carry counts and never a rate — a stored rate is a value computable from its two neighbours and therefore able to disagree with them, which is the rule that keeps `send_style` and grade ordinals derived (§7.3, D20)
- [x] 1.2 Implement the query: narrow through the `[discipline+grade_scale]` index for each pair present in the ticks, group by `protection` in memory, and count per grade label. Note in the comment that this is the first query the compound index was added for, and that protection joins the key rather than filtering after it
- [x] 1.3 Count with `isFirstEncounter` and `isFlash` imported from `db/style.ts`, never re-derived here, so one definition serves the metric and every display of a go
- [x] 1.4 Resolve each row's grade with `parseOrdinal`, never `ordinalOf`, and drop a tick whose label the current spec does not recognise from both the counts *and* the span — dropping it from the counts alone would let it reappear as an unmet grade. Cite `range.ts`'s incident in the comment
- [x] 1.5 Build each group's rows as a contiguous span from the easiest to the hardest grade holding a first encounter, easiest first, in `labels(scale)` order, emitting a row for every grade in between including those with zero encounters — the elision is a rendering concern and the shape stays honest here
- [x] 1.6 Order groups fixed: lead, toprope, autobelay, boulder, and by scale within. Document why this diverges from `groupGoes`'s first-appearance order — a reference screen returned to repeatedly must not reorder itself, whereas a session card is a record of a visit
- [x] 1.7 Tests in `db/flashRate.test.ts` against a fresh Dexie per test, as `range.test.ts` does: an unsent first encounter counts in the denominator; an `attempted` and a `sent` tick count in neither, sent or not; a flash counts in both
- [x] 1.8 Test that Font boulders and French boulders yield two groups and that no row's counts combine them; and that rope and boulder both graded French stay separate — the two halves of `(discipline, grade_scale)`, each shown unable to do the other's job
- [x] 1.9 Test that lead and toprope first encounters at one grade produce two groups with their own counts, and that boulder's `protection: 'none'` produces a group with no special-casing
- [x] 1.10 Test that a tick whose `grade_raw` is not a label of its `grade_scale` is excluded from every count, does not appear as an unmet grade in the span, and does not reject the query
- [x] 1.11 Test the span's ends are grades holding first encounters, that interior grades with zero encounters are present as zero-encounter rows, and that a protection whose ticks are all repeats yields no group at all

## 2. The chart row

- [x] 2.1 Add `features/flash/RateRow.tsx` rendering one grade: the label verbatim in tabular figures, a fixed-width track with a proportional fill, and `flashes/encounters` beside it. No `text-transform` anywhere near the label (§7.3, `DESIGN.md` §2)
- [x] 2.2 Render the three states distinctly — filled (`encounters >= 3`), a real zero (`encounters >= 3`, `flashes === 0`, empty fill), and suppressed (`encounters < 3`, no proportional fill, marked with a short word). Distinguish them by fill, track treatment and text, never by colour alone (`DESIGN.md` §3)
- [x] 2.3 Document the n < 3 rule at the component with its derivation, not just its value: with one encounter the only rates are 0% and 100%, with two they are 0%/50%/100%, so below three the rate's position relative to the reference rule carries no information while a fill asserts one. Cite D26
- [x] 2.4 Add `features/flash/GapRow.tsx` rendering an elided run of unmet grades, naming the range it covers (`7a+–7c+`) or the single grade when the run is one. Fix the elision threshold in code and state it in a comment as the arguable choice design.md flags
- [x] 2.5 Tests in `RateRow.test.tsx`: `3/8` draws a fill, `0/6` draws an empty fill and is distinguishable from a gap, `1/1` draws no fill and says why, and every state exposes its counts as text
- [x] 2.6 Tests in `GapRow.test.tsx`: a run of one names that grade, a run of five names the range, and neither renders a percentage

## 3. The chart and the selector

- [x] 3.1 Add `features/flash/RateChart.tsx`: a heading naming discipline and scale, the rows with runs of zero-encounter rows collapsed into `GapRow`, and one absolutely-positioned reference rule at 50% of the track column, labelled
- [x] 3.2 Always render the scale heading, including for a single chart, and comment the deliberate divergence from `SessionsScreen`'s `labelled = groups.length > 1` — the grade column is the axis here and nothing else distinguishes Font `6A` from French `6a`
- [x] 3.3 Add a group-labelling helper for `(protection, scale)`, separate from `groups.ts`'s `groupLabel` so a session card does not start reading `lead · French`. `none` reads as `boulder`, for the reason `groups.ts:64` already gives
- [x] 3.4 Add `features/flash/ProtectionSelector.tsx` over the protections present, in fixed order, labelling `none` as `Boulder`. Absent entries rather than disabled ones — `app-shell`'s tab-bar argument, one level down — and no selector at all when one protection qualifies
- [x] 3.5 Add `features/flash/FlashScreen.tsx`: load `flashRates` in `useEffect` into `useState` as every other screen does, hold the selected protection in `useState` — not a search param and not a preference — and render the selected protection's charts, one per scale
- [x] 3.6 Implement the conditional default: lead when lead has first encounters, otherwise the first protection in fixed order that does. Comment that §4.2's unconditional "lead by default" shows a boulderer an empty pane with their data one tap away
- [x] 3.7 Implement the empty state as prose explaining what will appear and roughly when, with no axis, no reference rule and no selector — and make the condition *no first encounters* rather than *no ticks*, so a logbook of only repeats gets prose rather than a chart of zero rates
- [x] 3.8 Tests in `FlashScreen.test.tsx` through `renderApp()`: the selector's membership follows which protections have first encounters; a single qualifying protection renders no selector; boulder reads as `Boulder`; auto-belay gets its own pane
- [x] 3.9 Tests for the default pane — lead when present, first-with-data when not — and that no pane is ever empty while data exists
- [x] 3.10 Tests that no element names a single grade as the climber's level, that no pyramid/volume/vertical-metre/trend figure appears, and that interacting with a row writes nothing to Dexie
- [x] 3.11 Test the empty state on a fresh logbook and on one holding only `attempted`/`sent` ticks

## 4. The route, the tab and the icon

- [x] 4.1 Register `/flash` in `router.tsx` by hand, beside the existing three, with no route plugin and no generated tree
- [x] 4.2 Add a `Flash` entry to `TABS` in `TabBar.tsx` with `exact: true`, in flow order between `Sessions` and `Settings`, and update the file header comment that currently names `Flash` as the unshipped surface
- [x] 4.3 Add one 24×24 `viewBox`, `currentColor`, `aria-hidden` icon in the style of its three neighbours, with a one-line comment saying what the shape depicts as the others have
- [x] 4.4 Test in `router.test.tsx` that `/flash` renders the surface directly on load and that the tab marks itself current, per `app-shell`'s route requirements

## 5. The documents

- [x] 5.1 `CONCEPT.md` §4.2 — drop `send_style` from the "every metric breaks down by `protection` *and* `send_style`" sentence: a flash is this metric's numerator, so segmenting flash rate by flash-versus-redpoint is incoherent, and the sentence predates D14 and D20
- [x] 5.2 `CONCEPT.md` §8 — turn the `Charts | uPlot or Recharts` row into a deferral, pointing at D25
- [x] 5.3 `docs/decision-log/25-the-one-chart-is-plain-dom.md` — D25, recording the reversal with its three grounds (install weight paid up front by the precache, a canvas chart being the only Phase 0 surface the suite cannot query, and the grade grid's plain-`<button>` precedent) and noting the `build-tooling` fence is *not* the reason
- [x] 5.4 `docs/decision-log/26-small-samples-are-shown-without-a-fill.md` — D26, carrying the derivation rather than the number, the worked soft-7b failure it prevents, that it is presentation and not a filter so D6 holds, and the Wilson interval as considered-and-deferred
- [x] 5.5 `docs/DESIGN.md` — a new section for this screen, which the document has never had: the row's anatomy, the reference rule as the reading gesture, the three row states, the elided gap, the always-present scale heading and the selector. Cross-reference `CONCEPT.md` §4.2 rather than restating the metric
- [x] 5.6 Add D25 and D26 to `CONCEPT.md`'s decision-log index and to `docs/decision-log/README.md` if it carries a list; update both documents' `Last updated:` lines

## 6. Verify

- [ ] 6.1 Run `just check` and confirm codegen, format, typecheck, lint and the full suite pass
- [ ] 6.2 Drive the surface in a real browser at 412×600 with the tab bar present: confirm a bar's rendered width matches its rate, that the reference rule lands where the fills are read against it, and that the suppressed and real-zero rows are distinguishable at a glance
- [ ] 6.3 Measure the tab bar with four tabs at 412×600: every label on one line, every target keeping its touch size, and the logging screen's grade grid still showing three rows — the floor `app-shell` pins was won by arguing over eight pixels, and jsdom reports every height as zero
- [ ] 6.4 Check both themes, `dim` and `winter`, since the track, the fill, the suppressed treatment and the rule are new surfaces against the theme tokens
- [ ] 6.5 Settle design.md's two open questions against the device — the elision threshold, and whether the rule's label appears per chart or once per screen — and fold the answers into the spec text
- [ ] 6.6 Log a handful of real goes on the trial device and read the screen as the climber: confirm the crossing is findable and that no row overstates a grade
