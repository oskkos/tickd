## Context

`CONCEPT.md` §12 asked whether Tampereen Kiipeilykeskus grades boulders in Font. It grades them in
French. The question was demoted to seed data when `venue` gained `default_scale_rope` and
`default_scale_boulder`, so the schema absorbs the answer without reshaping — but the *prose* did not,
because it had been written as though a scale implies a discipline.

That premise is stated in `CLAUDE.md`, three places in `CONCEPT.md`, two comments in `scales.yaml`, and
three statements in the `grade-scales` baseline spec. It was never argued for; D5 established that Font
and French are different *scales*, and "French is the rope scale" was read into it from the two gyms
then under consideration.

The code is unaffected. `packages/grade-spec` never modelled discipline — it deals in notations and
ordinals — so the corrected premise leaves its API and its tests intact. That the design survives a
falsified premise untouched is worth noting as evidence the layering was right.

## Goals / Non-Goals

**Goals:**

- Correct the premise everywhere it appears, in one change, including the baseline spec.
- Name what each separation layer is responsible for, since neither can do the other's job.
- Put `grade_scale` into the metric segmentation key before any metric is written against the old one.
- Record the accepted cost of two boulder pyramids, and what would reverse it.
- Close `DESIGN.md` §5's grid-direction question and record the PWA install browser.

**Non-Goals:**

- A `french_boulder` scale id. Rejected below.
- A Font↔French conversion table. Deferred, now with the cost written down.
- Any change to `packages/grade-spec` beyond comments.
- Revising D5. Its finding stands; only an implication read into it is wrong.
- Deciding how the analytics layer expresses its grouping key. That belongs to the change that builds it.

## Decisions

**A scale is a notation. Separation is two-layer.** The type system separates notations at compile time;
the consuming layer separates disciplines. This is not a weakening — a grade-level type *cannot* enforce
a discipline distinction, because discipline is a property of the tick, not of the grade. The previous
model appeared stronger only because the two known gyms made scale and discipline coincide.

**No `french_boulder` scale id.** This was the tempting fix and it is wrong. `CONCEPT.md` §7.3 requires
storing what was entered; the wall at Tampere says `6a` in French notation. A scale id meaning "French,
but for boulders" encodes an interpretation at write time — precisely the error §7.3 forbids for
ordinals, and for the same reason: interpretations get revised, and the record of what was entered must
survive the revision. It would also be a scale the gym does not believe exists.

The cost of not doing it is real and worth stating: `compare()` will accept a Tampere boulder ordinal
and a rope-route ordinal, because both are `Ordinal<'french'>`. That comparison is meaningless. The type
system cannot catch it, so the metric key must — which is why the key is specified here rather than left
to the analytics change to get right on its own.

**The metric grouping key is `(discipline, grade_scale)`.** Keying on discipline alone pools Font and
French boulders into one ranking of incomparable values. Keying on scale alone pools boulders with
routes. Either produces a plausible-looking wrong number rather than an error, which is the failure mode
§4.2's "segment, never exclude" exists to prevent.

**Two boulder pyramids, accepted.** Merging them requires a Font↔French conversion, which D1 and D5
defer and the `grade-scales` spec explicitly excludes. Building one now would mean adopting a contested
mapping to serve a single user's convenience during a one-month trial. The honest version is two
distributions and a note about why.

What would reverse it: bouldering seriously at both gyms and wanting one number. At that point the
conversion table is worth its cost, and it arrives as a versioned addition to `scales.yaml` — which is
what the version field has been waiting for since it was added with nothing to version.

**Grid order runs easiest-at-top.** `DESIGN.md` §5 left this open, noting bottom-up mirrors a wall and a
pyramid while top-down is less surprising. Less surprising wins: the grid is a list of values and reads
in the direction lists read. The thematic argument is real but pays off once, on first sight, against a
cost paid on every use.

**Recorded as a decision-log entry rather than a silent edit.** `CLAUDE.md` requires appending to the
log when a recorded position is revisited. D5 is not being reversed, so this is D17 — a correction to
what D5 was taken to mean, which is exactly the kind of thing the log exists to make visible.

## Risks / Trade-offs

- **A reader carries the old model into the analytics change** → every instance is corrected in one
  change rather than the ones that seem most important, and the baseline spec gains an explicit
  requirement rather than a corrected sentence.
- **The Tampere boulder pyramid may be sparse** if most bouldering happens at Kiipeilyareena, making the
  split look like a bug rather than a decision → the metric should show the scale it is keyed on, so two
  thin distributions read as two scales rather than as missing data. Noted for the analytics change.
- **`compare()` remains willing to rank a French boulder against a French route** → unavoidable without
  the rejected scale id; bounded by specifying the metric key here, before anything consumes it.
- **Editing comments in `scales.yaml` could plausibly change generated output** → it cannot, since the
  generator emits data derived from labels, and `codegen-check` proves it rather than assuming it.

## Migration Plan

Documentation only; nothing to migrate. No stored data exists, and the schema already supports the
answer.

Ordering that matters: the baseline spec's Purpose section carries the same wrong framing as its
requirements, and Purpose is not covered by MODIFIED/ADDED — it must be corrected during the sync or it
survives as the one place still asserting the old model.

## Open Questions

- **Does the analytics layer express the grouping key in types, or by convention?** A
  `PyramidKey = { discipline, scale }` would make the mistake unrepresentable in the same spirit as the
  ordinal work. Deferred to the change that builds the metric, which is where the shape will be obvious.
- **Do Tampere and Kiipeilyareena agree on what a French boulder grade means?** Not needed for Phase 0 —
  the scales stay separate either way — but it decides how a future conversion table is built, and it is
  cheap to observe while climbing.
