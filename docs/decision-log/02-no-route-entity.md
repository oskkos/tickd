---
id: D2
title: No route entity; `route` merged into `tick`
status: accepted
related: [D1, D3, D4]
---

# D2 — No route entity; `route` merged into `tick`

**Considered, in order:** (a) routes identified by hold colour; (b) routes identified by the natural
key `(venue, grade, colour, sector, not retired)`; (c) anonymous ticks with an optional `route`
entity; (d) one merged `tick` table.

**Decided:** (d).

Every identity scheme failed for the same unfixable reason: **a newly set 6c+ in sector 4 is
indistinguishable from the 6c+ that used to be in sector 4.** No observable signal separates them,
and the gyms in question don't use colours as identifiers.

The resolution was to stop inferring. You already know whether you've climbed something — you're
standing in front of it — and flash-versus-redpoint was always a self-report the app could never
verify. None of the analytics ever needed route identity; they compute from
`(grade, protection, send_style, prior_experience, date)`.

**An earlier claim in this document was wrong:** that route identity had to exist from day one or
retrofitting would be painful. For indoor that was simply incorrect, since indoor routes should
never enter a shared library. For outdoor it held, but D1 made the cost irrelevant.

**What this eliminated:** the `route` table, natural-key matching and its escape hatches, route
dedup as a Phase 1 blocker, the grade snapshot (D4), all route lifecycle fields (D3), and the
per-gym "currently up" grid.
