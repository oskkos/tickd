## Why

Flash rate by grade is the last of the four Phase 0 surfaces `CONCEPT.md` §"Phase 0" names, and it is the
only one that is not a logbook. Without it the exit criterion — *you log every session for a month and stop
reaching for anything else* — tests a plain offline logbook against a value proposition that does not yet
exist. §9.0 says so directly: flash rate ships in Phase 0 deliberately, because one real analytic is what
makes the trial a test of the product rather than of the data entry.

The metric itself is already most of the way built and has been waiting for a reader. `isFlash` and
`isFirstEncounter` in `db/style.ts` were written for this screen, carrying D14's argument in their doc
comments; `ticks` carries a `[discipline+grade_scale]` index that exists because every metric groups by that
pair and no Phase 0 query has used it yet; `parseOrdinal` orders grades within a notation. What is missing
is an aggregation across the whole logbook, a screen to read it on, and a fourth tab — `TabBar.tsx` already
names the gap: *"`Flash` is the one Phase 0 surface still unshipped."*

## What Changes

- **A flash-rate surface**, at `/flash`, reached from a fourth tab. It shows one metric and nothing else:
  flashes ÷ first encounters, per grade, for one protection at a time.

- **Plain DOM bars, and no chart dependency.** `CONCEPT.md` §8's stack table has carried
  `Charts | uPlot or Recharts` since before the grade grid was argued out as plain `<button>`s. The same
  argument applies with more force here: this is ten to twenty-seven rows of *label · bar · fraction*, so a
  bar is a `div` with a percentage width. Recharts is roughly 100 KB gzipped and install weight is paid up
  front because the service worker precaches the whole bundle before first use; uPlot is small but paints to
  canvas, which would make this the one Phase 0 surface the test suite cannot query and a screen reader
  cannot read. Recorded as **D25**, and §8's row becomes a deferral rather than a plan.

- **A vertical ~50% reference rule drawn through the bars.** §4.2's claim is that *the grade where your
  flash rate crosses ~50% is your real level*, so the rule is the reading gesture, not decoration: you scan
  the grade column for the row whose bar stops reaching the line. It is a line and a label, never a colour
  change — `DESIGN.md` §3 forbids colour as the only signal.

- **The crossing is not computed.** No *"your level: 6b"* headline anywhere. §4.2 is explicit that you read
  the crossing yourself rather than being handed a grade, and the sample sizes below are the reason: a
  headline would state a conclusion with more confidence than the data supports, and it is exactly the
  well-meant addition someone would make later, so it is specified as absent.

- **A rate computed from fewer than three first encounters is shown without a fill** (**D26**). With n = 1
  the only possible rates are 0% and 100%; with n = 2 they are 0%, 50% and 100%. Below three, the rate
  cannot take a value that sits meaningfully near the reference rule, so its position relative to that rule
  carries no information — and a full-length bar claims otherwise at exactly the grade where it does the
  most damage. One soft 7b in a month renders as the longest bar on the screen, at the hardest grade, and any
  glance reads *7b* against a true level two grades lower. The row still appears with its fraction, so
  nothing is hidden; only the claim the bar makes is withdrawn. This is a **presentation** rule and not a
  filter: the counts are unchanged, and D14's denominator is untouched.

- **The counts are always shown beside the bar** — `7a — 1/9`, in tabular figures, per §4.2's "shown with
  its raw counts". They are what makes the reader able to do what the previous two bullets decline to do for
  them.

- **A protection selector, carrying only the protections that have data.** Lead, toprope, auto-belay and
  boulder, where boulder is not a fourth protection but the absence of one: `protection = 'none'` *means*
  boulder (§7.4), and `groups.ts` already resolves that to the word *boulder* for the same reason. A
  protection with no first encounters is absent rather than disabled — the argument `app-shell` already makes
  for the tab bar itself, one level down: a disabled entry says the surface exists and is being withheld.
  With one protection present the selector does not render at all, since a control that never varies is
  noise.

- **Segmenting by protection is not garnish.** §4.2 requires it and D6's *segment, never exclude* is why,
  but the sharper reason is that pooling would break the metric rather than merely blur it: a toprope flash
  at 6b and a lead flash at 6b are different events, and pooling them raises the curve exactly where the
  crossing is read. Auto-belay laps get their own chart rather than being hidden or discounted, and that
  chart will be a near-flat 100% line — useless as a curve, correct as a refusal to drop data.

- **Within the selected protection, one chart per grade scale.** The key is `(discipline, grade_scale)` and
  neither half can do the other's job (§4.2, D17). With the seeded venues, boulder alone yields two charts:
  Font at the Kiipeilyareena sites and French at Tampere. The list of charts is therefore **derived from the
  ticks**, never a fixed set — hardcoding it is how a scale goes missing or two notations get pooled into one
  ranking of incomparable values.

- **Every chart names its scale, even when there is only one.** This deliberately diverges from
  `SessionsScreen`, which drops a group heading that never varies. Font `6A` and French `6a` differ only in
  letter case, and here the grade column *is* the axis with no surrounding visit to supply context — an
  unlabelled chart leaves the reader guessing which notation they are reading. Stated as a requirement so
  the inconsistency is not later "fixed" in the wrong direction.

- **The default pane is lead if lead has data, otherwise the first protection that does.** §4.2 names lead
  as the default view, and taken literally that shows an empty pane to someone who only boulders while their
  data sits one tap away.

- **The grade axis is a contiguous span from the easiest to the hardest grade with a first encounter, and
  runs of unmet grades in between collapse into one row naming the range.** A list of only the observed
  grades puts 6a next to 6c and makes the curve read steeper than it is; a row per unmet grade means one
  curious go on 8a adds eleven empty rows. One elision row — `7a+–7c+ · none yet` — keeps the axis honest
  about the gap while bounding the height whatever the range. The span's ends are observed by construction,
  so there is never a leading or trailing gap.

- **A grade with no first encounters is never rendered as 0%.** `0/0` is not a rate, and the elision row is
  what it renders as instead. A grade with encounters but no flashes *is* `0/6` and renders as an empty fill,
  which is a real measurement and reads differently.

- **All time, and no window control.** The pyramid's rolling twelve months is Phase 1's. Phase 0 holds no
  data older than the install, so a window selector would be a control over data that cannot exist.

- **Easiest grade at top**, matching the grade grid, where `DESIGN.md` §5 settled the direction.

- **An unreadable `grade_raw` skips its own row rather than rejecting the query.** `range.ts` carries the
  scar: Phase 0 has no migrations, so a label the current grade-spec no longer recognises is permanent, and
  one such row inside a `map` rejected a whole promise. The same rule and the same `parseOrdinal` apply here.

- **The empty state is prose.** `DESIGN.md` §"Empty states" asks for an explanation of what will appear and
  roughly when, rather than a chart axis with nothing on it — and this is the surface that section was
  written about.

- **Three documentation corrections.** §4.2's *"every metric breaks down by `protection` and `send_style`"*
  loses `send_style`: a flash *is* this metric's numerator, so segmenting flash rate by flash-versus-redpoint
  is incoherent, and the sentence predates D14 and D20. §8's chart row becomes the deferral above.
  `DESIGN.md` gains a section for this screen, which it has never had — §5 covers logging and nothing covers
  the chart.

Deliberately absent: the **grade pyramid**, **volume metrics**, **vertical metres** (wall heights are seeded
absent, §12 Q1), **trend and plateau detection**, and **send rate by `angle` or `holds`**. All are named in
§4.2 and all belong to Phase 1 or later; Phase 0 ships exactly one analytic, and D19/D21 additionally hold
that `angle` and `holds` are descriptive rather than analytic because annotations skew toward sends. Also
absent: any **confidence interval** on the rate, which is the statistically correct answer to the small
samples above and is over-engineering for one climber over one month — D26 records it as considered.

## Capabilities

### New Capabilities

- `flash-rate`: the surface and everything only it does — the metric's aggregation across the logbook and
  the `(discipline, grade_scale)` key it groups by, the protection selector and which protections it carries,
  the bar's shape with its reference rule and its counts, the suppression of a fill below three first
  encounters, the contiguous grade span and its elided gaps, the default pane, the all-time window, and the
  analytics this screen deliberately does not show.

### Modified Capabilities

- `app-shell`: the tab bar requirement names `Log`, `Sessions` and `Settings` as the shipped tabs and says
  `Flash` will be added when its surface ships. It ships here, so Phase 0's tab bar is complete and the
  requirement stops deferring.

## Impact

**Code**

- `apps/web/src/features/flash/` — new: the screen, the protection selector, the chart and its row.
- `apps/web/src/db/` — a new module for the aggregation: first encounters and flashes per grade, keyed by
  `(discipline, grade_scale)` and by `protection`, read through the compound index.
- `apps/web/src/router.tsx`, `components/TabBar.tsx` — one route, one tab, one 24×24 `currentColor` icon in
  the style of its three neighbours.
- `docs/CONCEPT.md` §4.2 and §8, `docs/DESIGN.md` — the corrections above, plus both `Last updated:` lines.
- `docs/decision-log/` — D25 and D26.

**Verification**

- The bars, the reference rule and the elision rows want measuring **in a real browser at 412×600 with the
  tab bar present**, as every screen since `app-shell` has been. jsdom reports every height as 0, so it can
  confirm the rows exist and their labels are right but not that a bar is the length it claims, that the rule
  lands where the fills are read against it, or that four tabs still fit the bar that has held three.

**Not affected**

- **No schema change and no new index.** The `[discipline+grade_scale]` index already exists for this query.
  The marker does not move, so an export taken before this change imports after it.
- **No new dependency**, which is the point of D25. The `build-tooling` scope fence is untouched either way —
  a chart library is not a network or server-state concern — so the fence is not the reason; weight,
  testability and the plain-`<button>` precedent are.
- **No write path.** This surface only reads. It cannot correct a go; the session detail remains the only
  repair path (D23).
