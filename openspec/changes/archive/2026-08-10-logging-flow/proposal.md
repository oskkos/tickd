## Why

Phase 0 has a storage layer and no way to put anything in it. The logging flow is the wedge
(`CONCEPT.md` §3) — everything else in Phase 0 exists to serve it, and flash rate has nothing to
measure until it ships.

It arrives with four model corrections because **the screen and the model disagree**. Exploring the
screen falsified parts of the tick shape that shipped three days ago: a `send_style` the user would
never distinguish, an `attempts` column nothing reads, a `venue_id` duplicated from the session, and a
handful of fields §7.7 named but never defined. Building the screen against today's model would mean
writing UI for `send_style` and `sector` that D20 and D21 delete.

The corrections are recorded as **D18–D21** and argued there. This change applies them.

## What Changes

**Model (D18–D21):**

- **`second_go` and `attempts` dropped.** A send is flashed or it is not; a field filled by accident
  produces a plausible wrong number rather than a visible gap.
- **`tick.venue_id` dropped**, with its index. A tick reaches its venue through its session. `date_local`
  stays duplicated because it legitimately diverges at midnight; `venue_id` never can.
- **A tick records one go, so `send_style` is dropped and derived.** `is_send` with
  `prior_experience = 'none'` *is* a flash — there is no other possibility once a tick is a single go.
  **Both invalid style combinations become unrepresentable rather than merely unreachable**, because no
  field remains that could contradict another.
- **`sector`, `high_point`, `conditions`, `felt` dropped**; `notes` carries them. `tags` replaced by
  typed `angle` (one of slab/vertical/overhang/roof) and `holds` (several of
  crimp/sloper/pinch/pocket/jug).

**The logging flow:**

- **Session start** — venue picker, GPS as a hint only, explicit start.
- **The grade grid** — the whole scale rendered easiest-first, scroll anchored so the working range
  (`[min−2 … max+2]` over the last 90 days, per `(discipline, grade_scale)`) is visible on open.
- **A 3×2 outcome grid** — `prior_experience` × `is_send`, six cells, every one valid. **The cell tap
  commits**; there is no confirm step, because an uncommitted tick is a tick you can lose and §4 requires
  every tap to persist immediately.
- **Annotate after commit** — `notes`, `angle`, `holds`, `rating`, `grade_opinion`, `length_m` edit a tick
  that already exists.
- **The recent list** — persistent undo, showing what was actually recorded rather than just the grade.
- **Session end** — a summary that doubles as the accidental-end guard, plus lazy close on next open for
  sessions left running. Zero-tick sessions are deleted.

Explicitly **not** here: the bottom navigation, flash rate, history, settings, JSON export/import, and the
session-scoped climb entity designed and deferred in D21.

## Capabilities

### New Capabilities

- `tick-logging`: The logging flow — session lifecycle, the grade grid and its working range, the outcome
  grid, commit and annotation, and undo.

### Modified Capabilities

- `local-database`: `send_style`, `attempts`, `tick.venue_id`, `sector` and `high_point` leave the tick;
  `conditions` and `felt` leave the session; `angle` and `holds` arrive. The "invalid style combinations
  do not compile" requirement is **removed** rather than relaxed — there is nothing left to combine.

## Impact

- **New**: `apps/web/src/features/logging/` and the tick/session write paths.
- **Rewritten**: `apps/web/src/db/types.ts`, `types.assert.ts` and `writes.assert.ts` — `TickOutcome` stops
  being a union, so most of the style assertions describe a problem that no longer exists.
- **`SCHEMA_MARKER` moves**, twice over. That is the derived marker doing its job.
- **Docs**: `CONCEPT.md` §7.2 (the identity tuple loses `sector`, `send_style` and `venue`), §7.4 (the
  three-field block becomes two, and its four-goes example contradicts D20), §7.7, §6 (`onsight` no longer
  stays in the model), and `CLAUDE.md`'s style invariant.
- **Risk**: this deletes assertions that were the previous change's whole point. The invariants are not
  being weakened — they become structural — but the diff will *look* like a retreat, and the specs need to
  say plainly why it is not.
- **Risk**: `prior_experience` becomes required input on every go and cannot be defaulted (D20). Getting it
  wrong inflates flash rate's denominator, which is why the outcome grid forces the choice.
