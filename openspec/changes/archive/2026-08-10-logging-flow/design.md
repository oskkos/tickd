## Context

`CONCEPT.md` §3 makes this the wedge: *"tap grade → tap style → logged"*, offline, at any gym. `DESIGN.md`
§5 calls it the most important screen in Phase 0 and the hardest layout problem. Everything already built
— the grade scales, the storage layer, the PWA shell — exists to serve it.

The design work happened in exploration and produced four decision-log entries (D18–D21) rather than a
set of screen sketches, because the screen kept falsifying the model. That order matters: the constraints
below are consequences of decisions already argued, not fresh choices.

Three shape everything:

- **A tick is one go (D20).** So `send_style` is derivable and `prior_experience` is required input on
  every log rather than a rare deviation.
- **Two style combinations were invalid (§7.4).** After D20 they are unrepresentable — there is no field
  left to contradict another — so the screen does not enforce them, it simply has no control for style.
- **Every tap must persist immediately (`DESIGN.md` §4).** Sessions are logged in fragments, between
  climbs, with chalky hands.

## Goals / Non-Goals

**Goals:**

- Two taps to log in every case, not only the steady state.
- The invalid combinations have no control, rather than a disabled one.
- Nothing is lost if the phone is pocketed mid-interaction.
- A session that is never explicitly ended still produces an honest duration.
- The screen works on day one, with no ticks and therefore no working range.

**Non-Goals:**

- **Bottom navigation and routing.** Phase 0 has avoided a router so far; this change does not introduce
  one.
- **Flash rate, history, settings, export/import.** Separate changes.
- **The session-scoped climb entity** (D21) — designed, deferred, and the reason annotations are per-go.
- **Editing an old tick's outcome.** Correction in Phase 0 is delete-and-relog; §7.1 allows `UPDATE`, and
  annotation uses it, but moving a tick between union members is not offered.

## Decisions

### 1. The outcome grid is the state space, not a validator

```
                  didn't send        sent
               ┌──────────────┬──────────────┐
    first go   │      ✗       │    FLASH     │
               ├──────────────┼──────────────┤
    tried it   │      ✗       │      ✓       │
               ├──────────────┼──────────────┤
    sent it    │      ✗       │      ✓       │
               └──────────────┴──────────────┘
```

Six cells, `prior_experience` × `is_send`, **all six valid**. `send_style` is derived on read, so a
flash-with-prior-experience is not blocked — it has no cell, because "flash" was never a button.

This is the same move the type union makes, applied to the screen: make the bad state unrepresentable
rather than unreachable. `CLAUDE.md` requires the UI to make the invalid combinations unreachable; after
D20 that requirement is satisfied by construction.

**`prior_experience` takes no default.** `DESIGN.md` warns that a sticky `redpoint` *"silently relabels
every subsequent tick"*; under one-go-per-tick a fixed `none` does exactly that, being correct on the
first go and wrong on every go after. A default that is wrong most of the time is worse than none,
because it is wrong silently — and wrong here manufactures first encounters that inflate flash rate's
denominator.

### 2. The cell commits; there is no confirm

An uncommitted tick is a tick you can lose. With a confirm step, `grade + cell` exists nowhere until a
third tap — and the moment between them is exactly when someone hands you a rope.

The mis-tap argument for confirming is already answered by §3: *"a two-tap UI maximises mis-taps, so
correction is the common case… undo must be instant and always visible."* Undo is the chosen mitigation;
a confirm button would solve the same problem twice and charge every log for it.

**Annotation therefore happens after the write**, against a tick that already exists. That is `UPDATE`
per §7.1 — and it lands on the safe side of the storage layer's own rule, since `local-database`'s design
requires outcome changes to go through `put` while *"fields outside the union may still use `update`"*.
`notes`, `angle`, `holds`, `rating` and `grade_opinion` are all outside it.

### 3. The grid renders the whole scale, anchored rather than truncated

`DESIGN.md` §5 proposes truncating to the working range with a "show all" expansion. This design renders
all 27 (or 23) labels and **sets the initial scroll position** so the working range is visible.

Rendering all avoids two problems truncation has: a day-one fallback when there is no range to truncate
to, and an expansion state that has to be reset when the scale switches. And easiest-first ordering means
a typical range already sits in the first few rows, so truncation buys less than it appears to.

**Anchoring is a starting position, not a scroll.** Set before paint, with no animation — the list simply
begins there, like a book opening at a bookmark. It recomputes on mount and on Rope ⇄ Bldr, and
deliberately **not** after each tick: re-anchoring mid-session would move the grid under a thumb that is
about to tap it.

The range is `[min − 2 … max + 2]` over the last 90 days, computed **per `(discipline, grade_scale)`** —
a single global range would mix French rope with Font boulder, which is the error §4.2 keeps warning
about. It uses all ticks rather than sends only: a grade you have been failing on is a grade you will be
back on.

**Accepted weakness:** `min`/`max` are outlier-sensitive, so one curious go on 8a drags the anchor. A
percentile would be robust and is not worth it for one user in a one-month trial.

### 4. Discipline switches the scale, and some venues offer only one

Rope ⇄ Bldr is a header mode, not a per-tick field. It re-renders a different grid — 27 French labels
become 23 Font ones at Kiipeilyareena — and re-derives the working range and the anchor.

Where the venue carries no scale for a discipline, the toggle for it is **absent, not disabled**:
Tampereen Kiipeilykeskus Lielahti is boulder-only. That falls out of `VenueScales` already being a union
where a missing scale means the discipline is not offered.

### 5. Session lifecycle: explicit both ends, lazy as the backstop

```
   ┌─────────┐  Start session   ┌──────────┐  End session   ┌──────────┐
   │  none   │─────────────────▶│   open   │───────────────▶│ summary  │
   └─────────┘   venue chosen   └──────────┘                │ + confirm│
        ▲                        │      ▲                   └──────────┘
        │                        │      └── ticks                │
        │   on open, idle > 6 h  │                               ▼
        └────────────────────────┘  ended_at = last tick    ┌──────────┐
              note shown             0 ticks → deleted      │  closed  │
                                                            └──────────┘
```

**The lazy trigger is idle-since-last-tick, not date change.** Closing on `date_local ≠ today` fires on
the one case §7.7 explicitly contemplates — logging past midnight — and would close a session while the
climber is still on the wall. Idle time does not have that false positive and still catches anything left
running overnight.

**`ended_at` is the last tick's `created_at`, never the moment of reopening.** Setting it to "now" would
reproduce the 72-hour session the fallback exists to prevent.

**The explicit end produces better data than the fallback** — it captures the cooldown and the sitting
around that first-tick-to-last-tick misses. That is what earns it a button rather than making it
ceremony. Its summary doubles as the accidental-end guard, so the safety step is not dead weight.

**A lazy close is announced**, not silent. A session quietly appearing in history that you never ended
reads like the app inventing data.

### 6. Annotations are per-go, and this is a known compromise

Because a tick is one go, `angle`, `holds`, `rating` and `grade_opinion` describe a *climb* while living
on a *go*. A route worked over four goes carries them on whichever go was annotated — systematically the
send, since nobody annotates the fall they walked away from.

D21 designed the session-scoped climb entity that fixes this and deferred it. The consequence is
accepted: **these fields are descriptive, not analytic.** No Phase 0 metric reads them, and a
"flash rate by angle" built on them would be biased toward sends.

## Risks / Trade-offs

- **This change deletes assertions that were the previous change's entire point** → the invariants are
  not weakened, they become structural, but the diff reads as a retreat. The delta spec removes the old
  requirement explicitly rather than editing it into something weaker, so the record says why.
- **`prior_experience` is required on every go and cannot be inferred** → there is no route entity
  (§7.2, D2), so the app cannot know your next tick is the same climb. Forced choice is the mitigation;
  the residual risk is a user who taps "first go" out of habit and inflates the denominator.
- **Two taps depends on `protection` being right by default** → it stays sticky, which `DESIGN.md`
  permits because a wrong `protection` is visible on screen. If it turns out not to be visible enough,
  the sticky default is the first thing to revisit.
- **The recent list is the only undo** → if it scrolls out of reach on a long session, a mis-tap becomes
  unfixable without a history screen this change does not build. Keep it short and reachable.
- **Anchoring could fight the user** → it is a starting position recomputed only on mount and scale
  switch. If it ever animates, it will feel like the app fidgeting.
- **Day one has no working range** → the anchor simply does not move, which is correct for someone with
  no history since easiest-first puts the low grades at the top anyway.

## Open Questions

- **Wall heights** (§12 Q1) remain unknown, so `length_m`'s override has nothing to override and the
  venue picker cannot show a height. Not blocking.
- **Whether the working-range query justifies a `[discipline+grade_scale+date_local]` index.** It runs on
  every launch; Phase 0's row counts do not need it. Changing indexes later is a schema change, so this
  is the moment to decide rather than the moment it hurts.
- **How long the recent list stays useful on a busy evening.** A real answer needs real sessions.
