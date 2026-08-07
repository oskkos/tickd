## Why

`CONCEPT.md` §12's second open question — does Tampereen Kiipeilykeskus grade boulders in Font? — is
answered, and the answer is no. **Tampere grades boulders in French.**

Every document in the repository states the opposite premise: French is for rope, Fontainebleau is for
boulder. That was never an invariant; it was a coincidence of the two gyms considered when D5 was
written. It appears in `CLAUDE.md`'s invariant list, three places in `CONCEPT.md`, the `scales.yaml`
comments, and — the reason this needs a change rather than an edit — three statements in the
`grade-scales` baseline spec.

One of those claims is not merely imprecise but produces a wrong number. §4.2 says every metric breaks
down by `protection`. With boulders now graded on two different scales at two gyms, a pyramid keyed on
discipline alone pools Kiipeilyareena's Font boulders with Tampere's French ones into a single ranking
of values that are not comparable. Flash-rate-by-grade is Phase 0's only analytic, so this is the whole
metric.

## What Changes

- **The invariant is reframed.** Scales are *notations*, not disciplines. Font and French remain
  separate ordinal namespaces — that part of D5 stands — but neither implies a discipline. French
  serves rope everywhere and boulders at Tampere; Font serves boulders at Kiipeilyareena.
- **Separation becomes explicitly two-layer**, with each layer's job named: the type system separates
  *notations* at compile time, and the metrics layer separates *disciplines*. Neither is sufficient
  alone.
- **The metric segmentation key gains `grade_scale`**, so two boulder scales produce two boulder
  pyramids rather than one wrong one.
- **Two boulder pyramids are accepted for Phase 0.** A Font↔French conversion table is the eventual
  answer and is deferred — consistent with D1 and D5, which defer all cross-scale conversion.
- **Two open questions close.** `DESIGN.md` §5's grid direction resolves to easiest-at-top, and the
  PWA install browser is recorded as Android Chrome, which fixes which IndexedDB will hold real ticks.
- **A decision-log entry** records the reframing, the accepted cost, and what would reverse it.

Explicitly **not** in this change:

- **No new scale id.** Minting `french_boulder` was considered and rejected: §7.3 says store what was
  entered, and the tag on the Tampere wall is a French grade. A scale id encoding "this is a boulder"
  would bake an interpretation at write time — the same error as baking an ordinal.
- **No conversion table.** Deferred deliberately, and its absence is now a recorded cost rather than an
  unexamined assumption.
- **No code changes.** `packages/grade-spec` needs none: it never modelled discipline, so the corrected
  premise leaves its API intact. Only its comments are wrong.
- **No change to D5.** Its finding — that Font and French are different scales — holds. What changes is
  an implication read into it.

## Capabilities

### Modified Capabilities

- `grade-scales`: three statements frame the namespace invariant as boulder-versus-rope rather than
  Font-versus-French, and the no-conversion requirement says Phase 0 groups "within a discipline" when
  it must group within a discipline *and* a scale.

## Impact

- **Documents**: `CONCEPT.md` (§1 summary table, §4.2 segmentation, §7.3 scales, §12 Q2, decision log),
  `CLAUDE.md` (the invariant), `DESIGN.md` (§5 grid direction), `apps/web/DEPLOY.md` (install browser),
  `packages/grade-spec/scales.yaml` (comments), `openspec/specs/grade-scales/spec.md` via the delta.
- **Code**: none. `scales.yaml` comment edits change no generated output, which the drift check confirms.
- **Downstream**: the analytics change must key pyramids on `(discipline, grade_scale)`. The seed row for
  Tampere sets `default_scale_boulder = 'french'` — a value the schema already supports, since
  per-discipline defaults landed before the answer did.
- **Risk**: a reader who learned "French = rope" from an older section carries the wrong model into the
  analytics work. Mitigated by correcting every instance in one change rather than the ones that seem
  most important.
