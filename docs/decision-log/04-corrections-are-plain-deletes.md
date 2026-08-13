---
id: D4
title: Corrections: plain `DELETE`, not tombstones
status: accepted
related: [D2]
---

# D4 — Corrections: plain `DELETE`, not tombstones

**Considered:** (a) append-only with supersede pointers and tombstones; (b) soft delete via
`deleted_at` plus last-write-wins; (c) ordinary `DELETE` and `UPDATE`.

**Decided:** (c).

The case for tombstones was the resurrection bug: you delete a tick on your phone, your laptop still
has it, and on next sync the laptop re-uploads it. **But that only happens if sync diffs local state
against the server**, and the design here is an outbox — a device pushes only operations it recorded
itself. The laptop never recorded creating that tick, so it has nothing to push. The bug was an
artifact of a sync design not in use.

The one real gap is that a hard delete leaves no trace for a long-offline device to learn from. The
textbook fix is a tombstone log; the cheap fix, at a few megabytes, is a periodic full re-sync on
app launch.

**A related item dissolved:** the grade snapshot (`grade_raw_at_tick`) was called the single most
important fix in the data model, because editing a route would retroactively move past ordinals.
D2 made it unnecessary — grade lives on the tick, so there is no route to edit. Structurally
impossible beats carefully handled.
