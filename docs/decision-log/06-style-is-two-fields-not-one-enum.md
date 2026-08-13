---
id: D6
title: Style: two fields, not one flat enum
status: accepted
related: [D14]
---

# D6 — Style: two fields, not one flat enum

**Considered:** the 8a.nu convention, a single enum of
`onsight | flash | redpoint | second_go | toprope | repeat`.

**Decided:** split into `protection` (lead / toprope / autobelay / none) and `send_style` (onsight /
flash / redpoint / second_go), plus a repeat flag — later widened to the three-value
`prior_experience` (D14).

The flat enum forces `toprope` into the same slot as `flash`, so a toprope flash and a toprope
redpoint are indistinguishable. Indoors, lead-versus-toprope is the *primary* quality axis, so that
discards the most interesting signal in the data. `protection = none` then separates boulder from
rope for free.

**On auto-belay:** the alternative was excluding auto-belay laps from pyramids by default, since
they're usually volume on easier terrain. Decided instead to **segment everything and exclude
nothing** — aggregating across categories is what misleads, and dropping data is its own distortion.
