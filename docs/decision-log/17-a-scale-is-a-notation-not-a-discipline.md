---
id: D17
title: A scale is a notation, not a discipline
status: accepted
related: [D5]
---

# D17 — A scale is a notation, not a discipline

**Considered:** treating French as the rope scale and Font as the boulder scale, as every section of
this document had assumed; minting a third scale id such as `french_boulder`; building a Font↔French
conversion table now so boulders form one pyramid; restricting the trial to one gym.

**Decided:** scales are notations. Font and French stay separate ordinal namespaces, but neither
implies a discipline. Two boulder scales therefore produce two boulder pyramids in Phase 0, and the
conversion table that would merge them is deferred.

**§12's second open question turned out to matter more than its phrasing suggested.** It asked whether
Tampere grades boulders in Font, framed as a seed-data detail once `venue` gained per-discipline
defaults. Tampere grades boulders in **French** — so one scale spans two disciplines and one discipline
spans two scales, and "French for rope, Font for boulder" was never an invariant. It was a coincidence
of the only two gyms considered when D5 was written.

**D5 is not reversed.** Its finding — that Font and French are different scales and must not share an
ordinal namespace — holds exactly. What was wrong is an implication read into it.

**The separation is two-layer, and this is not a weakening.** A grade-level type *cannot* enforce a
discipline distinction, because `discipline` and `protection` are fields on the tick rather than
properties of a grade. The old model looked stronger only because the two known gyms made scale and
discipline coincide. So: the type system separates notations at compile time, the consuming layer
separates disciplines, and §4.2's grouping key is `(discipline, grade_scale)`.

**`french_boulder` was the tempting fix and is wrong.** §7.3 requires storing what was entered, and the
tag on the Tampere wall is a French grade. A scale id meaning "French, but for boulders" bakes an
interpretation at write time — the same error §7.3 forbids for ordinals, and for the same reason: the
interpretation may be revised and the record of what was entered must survive it. It would also be a
scale the gym does not believe exists.

**The cost is real and is accepted rather than hidden.** Because both are `Ordinal<'french'>`, nothing
stops code comparing a Tampere boulder with a rope route, and that comparison is meaningless. The type
system cannot catch it; the metric key is what must, which is why §4.2 now specifies the key rather than
leaving the analytics work to infer it. And with bouldering split across two scales, Phase 0's single
analytic yields two thin distributions instead of one.

**What would reverse it:** bouldering seriously at both gyms and wanting one number. At that point a
Font↔French conversion earns its cost, and it arrives as a versioned addition to `scales.yaml` — which
is what the version field has been waiting for, having had nothing to version since it was added.

**What this changed:** §1's summary row, §4.2's segmentation and pyramid bullets, §7.3's scale bullets,
§12's second question, `CLAUDE.md`'s invariant, and the `scales.yaml` comments. No code:
`packages/grade-spec` never modelled discipline, so a falsified premise left its API and tests
untouched.
