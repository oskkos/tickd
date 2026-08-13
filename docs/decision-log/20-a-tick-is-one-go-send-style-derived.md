---
id: D20
title: A tick is one go, so `send_style` is derived rather than stored
status: accepted
related: [D2, D6, D7, D14, D18]
---

# D20 — A tick is one go, so `send_style` is derived rather than stored

**Considered:** keeping a tick as one climb-within-a-session, which is what §7.4's example assumed;
keeping `send_style` as a stored field because D6 decomposed style into three; keeping it for `onsight`,
which is the one value that is genuinely not derivable.

**Decided:** a tick records **one go**. `send_style` is dropped from the schema and computed at read
time. The style enum, including `onsight`, goes with it.

**These are one decision, not two.** `send_style` only became derivable because of what came before it:
D18 reduced it to `flash | redpoint`, and one-go-per-tick removes the case that made the pair
ambiguous. Under one-climb-per-tick, `prior_experience = none` with a send could be either a flash or a
four-go grind, and the field carried a real bit. Under one-go-per-tick it cannot:

```
is_send && prior_experience = none        →  flash     — this go IS the first acquaintance
is_send && prior_experience = attempted   →  redpoint
is_send && prior_experience = sent        →  redpoint
!is_send                                  →  no style
```

**§7.3's rule applies to more than ordinals.** *Store what was entered; derive the interpretation at
read time.* A stored value computable from two fields beside it is a value that can **disagree** with
its own source — which is the entire reason `TickOutcome` needed a union and the UI needed to make two
combinations unreachable. Removing the field removes the disagreement:

| `prior_experience` | `is_send` | means |
|---|---|---|
| `none` | false | first encounter, walked away |
| `none` | true | **flash** |
| `attempted` | false | another failed go |
| `attempted` | true | redpoint |
| `sent` | false | failed a repeat |
| `sent` | true | a repeat |

All six are valid. **There is no invalid combination left to police** — the two that §7.4 required the UI
to make unreachable are now unrepresentable, in the schema and on the screen alike, because neither has a
control for style.

**D6 is validated, not reversed.** Its finding was that a *flat* enum conflates protection, style and
history. Protection and history remain separate fields, so nothing is re-conflated; one of the three
pieces simply turned out to be a function of another. The decomposition is what made that visible.

**D14 is unchanged in substance.** Flash rate is still flashes ÷ first encounters, still counting ticks
with `prior_experience = none` including ones never sent. Only the numerator's expression changes, from
`send_style = 'flash'` to `is_send AND prior_experience = 'none'` — the same set of rows.

**The cost is real and falls on input, not storage.** With a tick as one go, `prior_experience` stops
being a rare deviation and becomes required on every log: correct on the first go, wrong on every go
after. So it takes no default and must be chosen explicitly. Getting it wrong manufactures first
encounters and inflates flash rate's denominator, which is why the screen forces the choice rather than
guessing it. The app cannot infer it — there is no route entity, so it cannot know your next tick is the
same climb (§7.2, D2).

**`onsight` is the one thing genuinely given up.** Outdoors, onsight versus flash turns on whether you
had beta — a bit `prior_experience` does not carry and nothing else in the schema does either. Indoors
it was already absent from the UI (§6), so nothing observable is lost now.

**What would reverse it:** outdoor logging, which needs `onsight` and therefore a stored style plus a
beta bit; or returning to one-climb-per-tick, which restores the ambiguity that made the field carry
information. D7 makes both cheap during Phase 0 — data is disposable and re-adding a column is the
wipe-and-restart already accepted.

**What this changes:** §7.4 loses the `send_style` row, its invalid-combination rules and the four-goes
example that assumed one tick could span several; §6's note that onsight stays in the model for outdoor
use; §7.7's `tick` block; `CLAUDE.md`'s style invariant; the `local-database` capability's
"invalid style combinations do not compile" requirement; and `apps/web/src/db/types.ts`, where
`TickOutcome` stops being a union.
