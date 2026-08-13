---
id: D21
title: The provisional fields resolved; `tags` becomes `angle` and `holds`
status: accepted
related: [D2, D6, D14, D18, D19, D20]
---

# D21 — The provisional fields resolved; `tags` becomes `angle` and `holds`

**Considered:** keeping §7.7's optional fields as listed; dropping every field with no named consumer;
`tags` as free text; `tags` as one flat enum of route characteristics.

**Decided:** four fields dropped — `sector`, `high_point`, `conditions`, `felt`. Four kept —
`length_m`, `grade_opinion`, `rating`, `notes`. `tags` replaced by two typed fields:

```
angle   slab | vertical | overhang | roof          -- one value
holds   crimp | sloper | pinch | pocket | jug      -- several
```

**Each field was put to three questions:** does anything read it, are its semantics defined, and would
you fill it consistently? The third is D18's test — a field filled by accident produces a plausible
wrong number rather than a visible gap.

**What the drops have in common is that `notes` already carries them.** Indoor `conditions` vary between
busy and not busy; `felt` is a sentence; a `high_point` has no defined format — a clip number, a metre
mark, "the crux"? — and under D20 it would want recording on every failed go. `sector` was the closest
call, since §7.2 names it in the tick's identity tuple, but a free-text location on an anonymous climb
is a note by another name.

**`sector` leaves a mark on §7.2.** With it and `send_style` gone, and `venue` now reached through the
session (D19), the identity tuple `(venue, sector?, grade, protection, send_style, prior_experience,
is_send, date)` needs rewriting rather than patching. What identifies a tick is now
`(grade, protection, prior_experience, is_send, date)` plus the session it belongs to.

**A flat `tags` enum would have repeated D6's error at a smaller scale.** D6's finding was that one enum
conflating independent questions cannot express their combinations — you could not distinguish a toprope
flash from a toprope redpoint. A single list mixing `overhang` with `crimp` has the same defect: a route
is not overhanging *or* crimpy, it is both. Wall angle and hold type are independent questions and get
independent fields.

**`angle` is a single value because it is the one that groups.** It is roughly exclusive, close to
objective, and slots into the existing key as `(discipline, grade_scale, angle)` with no array handling
and no multi-entry index. Hold type is genuinely plural and stays an array. If only one survives
contact with real sessions, it should be `angle`.

**Both vocabularies are deliberately short.** A long list is an unfillable list, and an unfilled field is
the thing three of these were just dropped for.

**A session-scoped climb entity was designed and deferred.** Because a tick is one go (D20), the
annotations above describe a *climb* while living on a *go*, so a route worked over four goes carries
them on whichever go you bothered with — and that is systematically the send, since nobody annotates the
fall they walked away from. Grouping the goes of one climb would fix it, and would also make
`prior_experience` derivable for every go after the first, repaying D20's stated cost.

It was rejected for Phase 0 on complexity, not principle. Linking cannot be inferred from grade — five
different 6b's in an evening are five climbs — and cannot be auto-attached to an open climb at the same
grade either, since a retry of something tried last week matches nothing on screen. Making it work needs
two distinct logging gestures, a grouped list as the only continuation path, and a disambiguation step;
that is a screen's worth of design for a field set that is descriptive rather than analytical.

**The accepted consequence:** `angle`, `holds`, `rating` and `grade_opinion` are descriptive metadata, not
analytic inputs. A "flash rate by angle" built on them would be biased toward sends, which is precisely
the kind of plausible wrong number D14 exists to prevent. If that analytic is ever wanted, the climb
entity has to come first.

**Note this does not reopen D2.** A session-scoped grouping has no identity beyond the session, is
asserted by tapping rather than matched, has no lifecycle fields, and supports no "currently up" view.
D2's unfixable problem — that a newly set 6c+ is indistinguishable from the one it replaced — is about
identity *across* time, and does not arise within a session you are standing in.

**What would reverse it:** wanting an analytic keyed on angle, which requires per-climb annotation and
therefore the deferred entity.

**What this changes:** §7.7's `tick` block, §7.2's identity tuple, the `local-database` capability, and
`apps/web/src/db/types.ts`.
