## Context

This is the last of Phase 0's four surfaces, and the only one that computes rather than records. It is also
the least code: the metric's two predicates, the index it groups by, and the ordinal machinery it sorts with
all exist already and were written with this screen named in their comments.

What is prepared:

- **`db/style.ts`** — `isFlash(outcome)` is the numerator, `isFirstEncounter(outcome)` the denominator, each
  carrying D14's argument in its doc comment. `isFirstEncounter` documents that it deliberately does not
  filter on `is_send`, because the climbs you walked away from are what keep the number honest at the limit
  grade.
- **`db/schema.ts`** — `ticks` carries `[discipline+grade_scale]`, whose comment says it exists "because
  **every metric groups by that pair**". No query has used it yet; `range.ts` is the only compound-index
  reader and it is not a metric.
- **`grade-spec`** — `parseOrdinal` for a `(raw, scale)` pair from data on disk, `labels(scale)` for the
  full easiest-first order, `labelOf` and `maxIndex` for the span.
- **`features/sessions/groups.ts`** — `groupGoes` splits a session's ticks by `(discipline, scale)` and
  `groupLabel` names the pair. Both are session-scoped and first-appearance ordered, which is right for a
  record of a visit and wrong for a reference screen. The reasoning transfers; the functions largely do not.
- **`components/TabBar.tsx`** — a three-entry `TABS` array whose comment says adding `Flash` "is one entry".

The constraints that actually shape the work:

- **No `dexie-react-hooks` anywhere.** Every screen loads through `useEffect` into `useState`. This screen
  reads a snapshot on mount and does not observe.
- **jsdom measures every height as zero.** Bar lengths, the reference rule's position and whether four tabs
  fit are settled in a real browser at 412×600 or not at all.
- **Phase 0 has no migrations**, so a `grade_raw` that the current `grade-spec` no longer recognises is
  permanent. `range.ts:68` documents what that cost: one such row inside a `.map` rejected the whole promise
  and left a discipline with no working range for ninety days.
- **Sparse data is the normal case**, not an edge. A month of one climber's ticks, split by protection, then
  by scale, then by grade, gives cells of n = 1 to 3 at the top of the range — which is where the metric is
  read.

## Goals / Non-Goals

**Goals:**

- One metric, computed the way D14 defines it, with the counts visible.
- A mark that makes the ~50% crossing scannable and that does not overstate a rate drawn from one climb.
- Segmentation that cannot pool incomparable values, derived from the data rather than hardcoded.
- A grade axis whose height is bounded regardless of how wide a range the climber covers.
- Testable by the same DOM queries as every other surface.

**Non-Goals:**

- Any second analytic. Pyramid, volume, vertical metres, trend, plateau, send rate by `angle`/`holds` are
  Phase 1+ (§4.2, D19, D21).
- A computed "your level" headline. §4.2 puts the crossing on the reader.
- A confidence interval. Correct, and over-engineering for one climber over one month.
- A time-window control. Phase 0 has no data older than the install.
- Cross-scale merging. A Font↔French conversion is deferred (D17), so two scales are two charts.
- Any write path. Correction stays on the session detail (D23).
- Reactivity. A snapshot on mount, like every other screen.

## Decisions

### Plain DOM over a chart library (D25)

```
row = [ grade label · fixed w · tabular ][ track · flex ][ fraction · fixed w · tabular ]

   6b   ██████████████┃░░░░░░░░░░░░░░░   7/11
                      ↑ reference rule at 50% of the track, absolutely positioned
```

A track is a `div` with a background, a fill is a nested `div` with `width: <rate>%`, and the rule is one
absolutely-positioned 1px element per chart. That is the whole rendering model.

*Alternatives considered.* **Recharts**: ~100 KB gzipped plus d3 subpackages, and install weight is paid up
front because the service worker precaches the bundle before first use. **uPlot**: ~15 KB, but canvas —
which makes the grade labels painted pixels rather than text, and this screen the only Phase 0 surface the
Testing-Library suite could not assert on and a screen reader could not read. Both are built for dense
multi-series or million-point time series; this is at most twenty-seven categorical rows. `DESIGN.md` §6
already reached the same conclusion about the grade grid — "the one place a library is actively wrong" — and
the argument is stronger here because the grid at least has 27 interactive targets.

The `build-tooling` scope fence is not the reason. A chart library is not a network, auth or server-state
concern, so the fence permits one; weight, testability and the plain-`<button>` precedent are what decline it.

### The mark: fixed track, fill = rate, one vertical rule

The track is a fixed width so that a single x-position means 50% across every row in a chart, which is what
lets the rule be one straight line you scan down.

*Alternative considered, and this is the close one:* **track length proportional to first encounters, fill
proportional to flashes.** It is elegant — a rate of 1/1 becomes a one-unit stub rather than a full-length
bar, so small samples are self-limiting with no threshold, no colour trick and no statistics. It was rejected
because it destroys the reading gesture: with every row a different length there is no single x-position that
means 50%, the rule cannot be drawn, and the reader is left comparing fill *fractions* across
differently-sized bars, which people read badly. It fixes the overstatement by removing the thing the screen
is for.

### Below three first encounters, no fill (D26)

```
   6c   ████████┃░░░░░░░░░░░░░░░░   3/8              ← n ≥ 3, filled
   7a   ░░░░░░░░┃░░░░░░░░░░░░░░░░   0/6              ← n ≥ 3, a real 0%
   8a   ┈┈┈┈┈┈┈┈┃┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈   1/1 · too few    ← n < 3, no fill
```

The floor is derived rather than picked. With n = 1 the only attainable rates are 0% and 100%; with n = 2
they are 0%, 50% and 100%. Below three, the rate cannot land anywhere that is *near* the rule without being
exactly on it, so its position relative to the rule carries no information — and drawing a fill asserts a
position. The failure this prevents is concrete: one soft 7b in a month renders as the longest bar on the
screen at the hardest grade, and length is read before the `1/1` beside it, especially in a dim gym at a
glance.

Three things this is not:

- **Not a filter.** The row renders, with its fraction and its grade. D14's denominator is untouched and the
  counts are unchanged. Only the bar's claim is withdrawn, which keeps *segment, never exclude* intact —
  D6's rule is about not dropping data, and nothing is dropped.
- **Not colour.** The suppressed state is conveyed by the absent fill, a distinct track treatment and a short
  word, per `DESIGN.md` §3.
- **Not a statistic.** *Alternative considered:* a Wilson score interval, which gives 1/1 ≈ [21%, 100%] and
  says "unknown" honestly and continuously. Rejected for Phase 0: it needs a stats function and a whisker
  mark, and it is a lot of ink across twenty rows on a 412px screen for one climber's trial. Recorded in D26
  so a later phase can reach for it rather than rediscover it.

### Segmentation: a protection selector over per-scale charts

```
┌──────┬─────────┬───────────┬─────────┐   ← only protections with a first encounter
│ Lead │ Toprope │ Autobelay │ Boulder │     absent, never disabled; hidden entirely if one
└──────┴─────────┴───────────┴─────────┘

  BOULDER · FONT                     ← one chart per grade_scale present, always labelled
  BOULDER · FRENCH                   ← seeded reality: Font at Kiipeilyareena, French at Tampere
```

**Why a selector rather than five stacked charts.** Stacking every `(protection, scale)` pair is roughly 2.7
screens of scroll at 412×600 and buries the comparison. `DESIGN.md` §6's expected-usage table already maps
*"Boulder / rope toggle, analytics views"* to `Tabs`, so the selector is the documented intent.

**Why the list is derived.** The key is `(discipline, grade_scale)` and boulder alone spans two scales under
today's seed (D17). A hardcoded set of four panes drops a scale or pools two notations whose labels differ
only in letter case.

**Why absent rather than disabled.** `app-shell` argues this for the tab bar — "a disabled or empty tab
implies the surface exists and is being withheld" — and the argument does not depend on being a tab bar. A
single remaining protection means no selector at all, which is the call `SessionsScreen` already makes about
a group heading that never varies.

**Why boulder is in the selector at all.** `protection = 'none'` *means* boulder (§7.4), so the control is
over the four ways a go is protected, one of which is not being protected. It is labelled `Boulder`, never
`None` — `groups.ts:64` already resolves it that way, "because that is what it means."

**Why the default is conditional.** §4.2 names lead as the default view. Applied literally, a climber who
only boulders opens the screen onto an empty pane with their data one tap away. So: lead when lead has data,
otherwise the first protection that does. The set of protections with data is already computed to build the
selector, so this is free.

**Why every chart names its scale, diverging from `SessionsScreen`.** That screen drops a heading that never
varies, and it is right to: the pills sit inside a visit that supplies the context. Here the grade column
*is* the axis and there is no surrounding context, so an unlabelled chart leaves the reader unable to tell
Font `6A` from French `6a`. Specified so the inconsistency is not later reconciled the wrong way.

**Selector state is plain React `useState`.** Not a search param — `app-shell` requires the back gesture to
move between tabs, and threading protection into the URL would make back step through tab taps instead of
leaving the screen. Not a stored preference either: the preferences module exists for choices that are
annoying to redo, like theme and haptics, and this is one tap.

### The grade axis: contiguous span with elided gaps

```
   6a   ████████████████████░░░░░░░░░░   8/9
   6b   ██████████████┃░░░░░░░░░░░░░░░   7/11
   6c   ████████░░░░░░┃░░░░░░░░░░░░░░░   3/8
   7a   ░░░░░░░░░░░░░░┃░░░░░░░░░░░░░░░   0/6
        ┄┄┄┄┄┄ 7a+–7c+ · none yet ┄┄┄┄┄            ← five unmet grades, one row
   8a   ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┃┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈   1/1 · too few
```

Three candidate axes and why this one:

| Axis | Problem |
|---|---|
| Only grades with a first encounter | Puts 6a next to 6c, so the curve reads steeper than it is |
| One row per grade in the span | One curious go on 8a adds eleven empty rows; height unbounded |
| Span with runs of unmet grades elided | Height bounded, adjacency still visibly not adjacency |

The span runs from the easiest to the hardest grade holding a first encounter, so **both ends are observed by
construction** and there is never a leading or trailing gap — only interior ones. A run of one renders as
itself (`6b · none yet`); a run of many renders as one row naming the range it swallowed, so no information is
lost. This is the same outlier sensitivity `range.ts:44` documents for the grade grid, handled here by
bounding the render rather than by a percentile.

A grade inside a gap has `0/0`, which is not a rate and is never drawn as 0%. A grade with encounters and no
flashes is `0/6`, which is a real measurement, and the two must not look alike.

### Aggregation shape and where it lives

A new `db/` module, beside `range.ts` and for the same reason: it is a read over the compound index that
returns a shape the UI renders, and the grouping rule is a data invariant rather than a presentation choice.

```
flashRates(db) →  readonly FlashRateGroup[]

FlashRateGroup { discipline, scale, protection, rows }
FlashRateRow   { label, encounters, flashes }   ← rate and suppression derived at render
```

Notes on the shape:

- **`protection` is part of the group key alongside `(discipline, scale)`**, not a filter applied after.
  Boulder's `none` then produces a group naturally, with no special case, because the pairing in
  `TickDiscipline` guarantees `none` occurs with exactly one discipline.
- **`rows` carries counts, not a rate.** A stored rate would be a value computable from its two neighbours
  and therefore able to disagree with them — the same rule that keeps `send_style` and grade ordinals
  derived (§7.3, D20). Suppression and percentage are computed where they are drawn.
- **The query narrows through `[discipline+grade_scale]`, then groups in memory.** `schema.ts` already
  states that grades are grouped in memory once the compound index has narrowed the set, and a month is a few
  hundred rows. The distinct `(discipline, scale)` pairs come from `SCALE_IDS` × the disciplines, or from one
  pass over the ticks; either is trivial at this size.
- **`parseOrdinal`, never `ordinalOf`.** A row whose label the current spec does not recognise is skipped —
  it is excluded from both counts and from the span, so it cannot silently become a `0/0` gap either.
  `range.ts` carries the incident this rule comes from.
- **Only `isFirstEncounter` rows count at all**, and `isFlash` rows among them. Both predicates are imported
  from `style.ts`; this module does not re-derive either, so a change to the definition cannot leave two
  copies disagreeing.

Order within a group is easiest-first, matching `labels(scale)` and the grade grid's settled direction
(`DESIGN.md` §5). Group order is fixed — lead, toprope, autobelay, boulder, and by scale within — not
first-appearance: this is a reference screen you return to, and one that reorders itself is disorienting.
That is the deliberate divergence from `groupGoes`, whose first-appearance order is right for a visit.

### Empty states, of which there are two

- **Nothing at all**, or nothing with a first encounter: prose explaining what will appear and roughly when,
  per `DESIGN.md` §"Empty states", which was written about this screen. No axis, no zero rows, no selector.
- **A protection with data but no first encounters** is not in the selector, so its pane is unreachable. This
  is possible in practice — a session logged entirely as `attempted` and `sent` repeats — and it is why the
  selector's condition is *has a first encounter* rather than *has ticks*.

### Testing

- **Unit tests on the aggregation**, against a fresh Dexie per test as `range.test.ts` does: the two
  predicates' effect on numerator and denominator, `(discipline, scale, protection)` never pooling — the
  Font-and-French-boulder case is the one that matters and it is seeded — an unparseable label skipping its
  row without rejecting, and a `0/0` grade never appearing as a rate.
- **Component tests** on the row's three states (filled, real zero, suppressed), the elision row's label, the
  selector's membership and its conditional default, and the scale heading's presence with a single chart.
- **A real browser at 412×600 with the tab bar present.** jsdom cannot tell a bar of the right length from
  one of the wrong length, cannot check the rule lands where the fills are read against it, and cannot
  confirm four tabs still fit a bar that has held three. `app-shell` pins the grade grid's floor with the tab
  bar present, and that floor was won by arguing over eight pixels — a fourth tab changes label widths, so
  the tab bar's own geometry is re-measured too.

## Risks / Trade-offs

- **The n < 3 floor will suppress genuinely interesting rows.** A first 7a flash is a real event and this
  screen declines to draw it → It still renders, with its count and a word saying why the bar is absent. The
  alternative — a full bar at the hardest grade from one climb — misstates the one thing the screen exists to
  say. D26 records the interval approach for when there is enough data to want it.
- **A single elision row can hide a long stretch of the scale**, so a reader may under-read how far above
  their range one outlier sits → The row names the grade range it covers, so the distance is stated in text
  even though it is not drawn to scale. Drawing it to scale is the unbounded-height option this rejects.
- **All-time will become wrong.** Once the logbook spans a year, mixing last winter's ability with this
  month's flattens the curve → Acceptable and stated: Phase 0 cannot hold such data. The window arrives with
  the pyramid in Phase 1, which needs one anyway.
- **Auto-belay's chart is near-useless** — a flat line at or near 100% → Kept, because D6's *segment, never
  exclude* is specifically that auto-belay laps get their own numbers rather than being hidden or discounted.
  Its uselessness is information.
- **A protection appearing and disappearing from the selector as data arrives** could read as a bug → It is
  the same rule the tab bar already applies to whole surfaces, and the alternative — a disabled entry — is the
  worse lie by `app-shell`'s own argument.
- **The screen is a snapshot and will go stale behind a logging session** → Every other screen behaves this
  way; `dexie-react-hooks` is available and deliberately unused so far. Not worth introducing for a screen
  you open between climbs.
- **`(discipline, scale, protection)` is a three-part key while the index is two-part** → The index narrows;
  protection groups in memory. At a few hundred rows the cost is nil, and adding an index would move the
  schema marker and refuse every existing export for no gain.

## Open Questions

- **The elision threshold.** A run of one unmet grade obviously renders as itself; a run of five obviously
  elides. Whether the boundary is two or three is unsettled and is a rendering choice with no correctness
  consequence — pick one in implementation, state it in the spec, and revise it against the real device.
- **Whether the reference rule is labelled per chart or once per screen.** Two charts stacked means the label
  appears twice, which may read as noise. Settle it in the browser.
