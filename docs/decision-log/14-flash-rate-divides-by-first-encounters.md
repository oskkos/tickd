---
id: D14
title: Flash rate divides by first encounters, not by sends
status: accepted
related: [D2, D6]
---

# D14 — Flash rate divides by first encounters, not by sends

**Considered:** the denominator this document originally specified in §7.7 — "pyramids and flash rate
filter `is_send = true`" — making flash rate *flashes ÷ sends at that grade*.

**Decided:** *flashes ÷ first encounters*, where a first encounter is any tick with
`prior_experience = none`, sent or not.

**The sends-only filter is biased upward exactly where the metric is read.** Ten different 7a's — one
flashed, one redpointed after three goes, eight abandoned without ever sending — gives 1 ÷ 2 =
**50%**, reading as "7a is your level", against a true 1 ÷ 10 = **10%**. Easy grades are barely
affected, since nearly everything you get on there is a send, so the curve flattens at the top and
pushes the 50% crossing upward. That crossing is the one number the metric exists to locate, so the
flagship analytic was measuring itself wrong.

Counting attempt *rows* instead fails in the other direction — those eight routes might be twenty
attempt rows, giving 4.5% — and grouping rows by `(date, venue, sector, grade)` to approximate
"routes" miscounts both ways: one route worked over three sessions becomes three failures, while
three different 7a's failed in one session in one sector collapse to one. It would also quietly
reintroduce, in the analytics layer, the identity inference D2 removed from the data model.

**The fix is D2's own argument applied to analytics: stop inferring and ask.** You know whether you
have touched a route before, because you are standing in front of it. Recording that as
`prior_experience` gives an exact denominator with no route entity, no grouping heuristic and no
dedup — and it subsumes the repeat flag from D6 rather than adding a field alongside it.

**What this changed:** the repeat boolean became `prior_experience`; `send_style` became nullable,
since it is meaningless on an attempt; the §7.7 note about filtering `is_send = true` was corrected;
and `DESIGN.md` §5 lost its last-used `send_style` default, because a sticky `redpoint` would
silently relabel every subsequent tick and corrupt the flagship metric rather than merely being
untidy.
