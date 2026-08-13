---
id: D18
title: `second_go` and `attempts` dropped; a send is flashed or it is not
status: accepted
related: [D6, D7, D12, D14, D17]
---

# D18 — `second_go` and `attempts` dropped; a send is flashed or it is not

**Considered:** keeping `second_go` as a fourth `send_style` because it is the near-miss signal; keeping
it in the model but hiding it from the indoor UI, as §6 does for `onsight`; adding a `resend` value for
sends of something already sent; keeping `attempts` as a coarse record of goes within one tick.

**Decided:** `send_style` for indoor use is `flash` or `redpoint`. A send is either clean on first
acquaintance or it is not. `second_go` and the `attempts` column are both removed.

**The taxonomy is the argument.** `second_go` records a distinction that is not made when logging, so
every value it took would be an accident of which button was nearer. A field filled inconsistently is
worse than an absent one: it produces a plausible wrong number rather than a visible gap. That is the
same reasoning D14 used to make flash rate divide by first encounters, and the same reasoning that
leaves `default_route_length_m` unseeded rather than guessed (§12).

**`send_style` still earns its place.** With only two values it carries exactly one bit that
`prior_experience` cannot: *within a first encounter, was it clean?* That bit is flash rate's numerator
(§4.2, D14), so the field cannot be folded away even though it is now effectively a boolean.

**The two fields stop overlapping entirely:**

| `prior_experience` | `send_style` | reads as |
|---|---|---|
| `none` | `flash` | clean on first acquaintance |
| `none` | `redpoint` | never touched, took more than one go |
| `attempted` | `redpoint` | had tried it before |
| `sent` | `redpoint` | a repeat |

**`resend` was considered and rejected on D6's own grounds.** `repeat` was a value in the flat 8a.nu
enum that §7.4 decomposed, and pulling it out into `prior_experience` was the point of that
decomposition. Re-adding it as a `send_style` would put one fact in two places, which means they can
disagree — `resend` with `prior_experience = none` is nonsense — and would create a *third* invalid
combination to police for no new information. A resend is `prior_experience = sent` with
`send_style = redpoint`, and `is_repeat` derives from the first exactly as D6 intended.

**`attempts` had no consumer, which is what distinguishes it from its neighbours.** §4.3's project view
counts attempts as `is_send = false` **rows** — that is what §7.7 means by "Phase 0 captures attempts
for free", and it is why D12 dropped the separate `attempt` table. The `attempts` integer was a second,
unused way to say the same thing. Contrast `high_point`, which is named by §4.3's high-point
progression and stays.

**Two things become unrecordable, and both are accepted.** The near-miss — fell once, got it next go —
is now an ordinary `redpoint`. And on a repeat, a clean lap is indistinguishable from a four-go grind,
because `flash` is correctly blocked once you have touched the climb. Neither is visible to Phase 0's
single analytic: a repeat is not a first encounter, so it sits in neither flash rate's numerator nor
its denominator.

**The `onsight` precedent does not transfer.** `onsight` stays in the model while absent from the
indoor UI because it is genuinely needed outdoors one day — a deferred requirement. `second_go` has no
such future; keeping it would mean carrying a value nobody writes, that every consumer must still
branch on, on the grounds that a Phase 3 user might want it. Re-adding an enum value is the cheap
direction, and D7 makes it free during Phase 0: data is disposable, so a schema change is a
wipe-and-restart already accepted.

**What would reverse it:** wanting the near-miss signal for real, at which point `attempts` returns as
a number rather than `second_go` as a bucket — a count beats a coarse label, and it also recovers the
clean-lap case on repeats.

**What this changes:** §7.4's `send_style` enum and its invalid-combination note, §7.7's `tick` block,
`CLAUDE.md`'s style invariant, the `local-database` capability, and `apps/web/src/db/types.ts`. Unlike
D17 this one **does** change code — `TickOutcome` loses a member and the tick row loses a column — so
it lands as its own change rather than a documentation edit.
