---
id: D26
title: A rate from fewer than three first encounters is shown without a fill
status: accepted
related: [D6, D14]
---

# D26 — A rate from fewer than three first encounters is shown without a fill

**Considered:** drawing every rate as a bar and trusting the counts beside it, which is what §4.2's
`7a — 1/10` implies; making a bar's *length* proportional to first encounters and its fill to flashes, so
that a small sample is self-limiting; a Wilson score interval per grade; and suppressing the fill below a
floor.

**Decided:** a fixed-width track for every row, and **no proportional fill when the denominator is below
three**. The row keeps its grade and its counts, and is marked as having too few encounters to draw.

**D14 fixed which denominator; it never addressed a denominator of one.** Flashes ÷ first encounters is the
honest ratio, and at the top of your range a month of logging supplies one or two first encounters per
grade. One soft 7b, flashed, is `1/1` — a rate of 100%, and therefore **the longest bar on the screen, at
the hardest grade on it**. Length is read before the text beside it, more so one-handed in a dim gym, so
the screen's headline reads *7b* against a true level two grades lower. The metric exists to locate the
~50% crossing, and sparse cells cluster exactly where that crossing sits, so the noise lands on top of the
reading rather than beside it.

**Three is derived, not picked.** With one first encounter the attainable rates are 0% and 100%. With two
they are 0%, 50% and 100%. Below three, a rate cannot take a value that sits *near* the reference rule
without being exactly on it — so its position relative to the rule carries no information, while a fill
drawn to that position asserts one. At three and above the rate can land between the extremes, and the bar
starts meaning something. The floor is a property of the arithmetic rather than a tuning constant, which is
why it is written down here instead of chosen inside a component.

**This is presentation, not exclusion, and the distinction is load-bearing.** The row renders, the grade
renders, the counts render. No tick leaves the denominator D14 defines and no group is dropped, so D6's
*segment, never exclude* holds exactly. What is withdrawn is the bar's claim about where the rate falls —
the one part of the row that was not measured well enough to make it.

**The proportional-track alternative was close, and lost to the reading gesture.** Scaling each bar's
*track* to its denominator makes small samples visibly small with no threshold at all, no colour trick and
no statistics — an elegant fix. It fails because every row then has a different width, so no single
x-position means 50%, the reference rule cannot be drawn, and the reader is left comparing fill *fractions*
across differently-sized bars. It removes the overstatement by removing the thing the screen is for.

**A confidence interval is the correct answer, and is deferred rather than rejected.** A Wilson score
interval puts `1/1` at roughly [21%, 100%] — a whisker wide enough to say "unknown" continuously, with no
floor to justify. It needs a statistics function and a second mark, and it is a great deal of ink across
twenty rows on a 412 px screen for one climber over one month. Named here so that a later phase reaches for
it rather than rediscovering it.

**What this changes:** the `flash-rate` capability gains a requirement for the suppressed state, with
scenarios pinning `1/1` against `3/8`; `DESIGN.md` gains the three row states — filled, a real zero (`0/6`,
an empty fill, which is a measurement) and suppressed (`1/1`, no fill) — and the rule that they are
distinguished by fill, track treatment and text rather than by colour, per §3.

**What would reverse it:** enough data per grade that the floor stops firing, which is the interval's cue
too. Once a logbook holds a year and the thin cells are the genuinely new grades rather than most of the top
half of the range, the interval says more than a threshold does and the threshold's job is finished.
