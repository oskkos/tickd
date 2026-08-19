---
id: D25
title: The one chart is plain DOM, not a charting library
status: accepted
related: [D22]
---

# D25 — The one chart is plain DOM, not a charting library

**Considered:** Recharts and uPlot, the two named in `CONCEPT.md` §8's stack table since it was written;
and plain DOM elements.

**Decided:** plain DOM. §8's row becomes a deferral rather than a plan, and Phase 0 adds no charting
dependency.

**The row predates the argument that settles it.** §8 named a chart library while the UI stack was still
MUI-shaped, before `DESIGN.md` §6 worked through the grade grid and concluded that 27 buttons are "the one
place a library is actively wrong". The flash-rate chart is the same shape of problem with less on either
side of it: at most twenty-seven rows of label, bar and fraction, where a bar is a `div` with a percentage
width and the axis is the grade column. There is no dense multi-series plot, no time axis, no zoom and no
tooltip — the reader scans a column for where the bars stop crossing a rule.

**Install weight is paid before first use.** The service worker precaches the whole bundle, so weight is
not amortised across a session the way it is on a website; it is install cost, on a phone, in a gym.
Recharts is roughly 100 KB gzipped plus its d3 subpackages, for one screen out of four.

**uPlot is small and still wrong, for a different reason.** At ~15 KB it would be cheap, but it paints to
canvas. That makes the grade labels pixels rather than text, which collides with two live rules:
`DESIGN.md` §2 requires `grade_raw` to render verbatim — Font `6A` and French `6a` differ only in letter
case — and every other Phase 0 surface is tested through DOM queries. A canvas chart would be the only
screen in the app the test suite cannot assert on and a screen reader cannot read, so the one analytic the
phase ships would also be the one surface with no coverage of what it displays.

**The scope fence is not the reason, and saying so matters.** `build-tooling`'s Phase 0 fence excludes
HTTP, auth, sync and server-state libraries. A charting library is none of those, so the fence permits one
— this decision is weight, testability and precedent, not a rule lookup. Recording that keeps the fence
honest rather than letting it become a general-purpose argument against dependencies.

**What this changes:** `CONCEPT.md` §8's `Charts` row; the `flash-rate` capability gains a requirement that
the surface renders without a charting dependency, with a scenario asserting every row is present in the
accessibility tree as text.

**What would reverse it:** a chart Phase 0 does not have — a trend line over time, a pyramid with stacked
segments per protection, anything with a continuous x-axis or interaction beyond reading. Those arrive with
Phase 1's volume and pyramid views, and one of them is where a library starts being cheaper than the
alternative. Reaching for it then is not reopening this; it is the condition this names.
