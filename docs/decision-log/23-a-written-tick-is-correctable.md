---
id: D23
title: A written tick is correctable, per go, and never across a discipline
status: accepted
related: [D14, D17]
---

# D23 — A written tick is correctable, per go, and never across a discipline

**Considered:** leaving history immutable and handling mis-taps with undo only; making the three paired
unions editable in full, including the discipline; a bulk correction applying one value to several goes;
delete-and-relog as the repair path.

**Decided:** a written tick's **grade**, **protection** and **outcome** are correctable, from both
surfaces that show a go. Correction is **per go**. It **never crosses a discipline**: a roped tick's
protection moves within `lead`/`toprope`/`autobelay`, a boulder is offered no protection control at all,
and a grade may only be re-picked from the notation the tick already carries.

**Why anything changed.** The first real test session produced two rows that could not be repaired. A
grade cell was mis-tapped. And a stale sticky `protection` recorded several toprope laps as lead —
noticed mid-session, by which point the only tool was undo, which meant deleting from the middle of the
evening. Everything else a tick carries was already editable; the three exceptions were exactly the
paired unions, excluded because `annotateTick` patches individual fields and a partial of a
discriminated union is unsound. The `sessions-view` capability stated that gap in writing rather than
implying it away, and named `prior_experience` the worst of the three because it is flash rate's
denominator (§4.2, D14).

**Why not undo, even mid-session.** Removing a go and logging it again appends it at the end, and
`logTick` stamps `date_local`, `tz_offset` and `created_at` from the moment of logging — so a Tuesday
climb re-logged on Thursday becomes Thursday's, permanently, in a phase with no migrations. It also
rewrites the sequence of the visit, which is the thing the session detail exists to show. Correction is
therefore an in-place whole-row `put` that preserves identity, the three time fields and every
annotation.

**Why the discipline is out.** The scale travels with the discipline (D17): Kiipeilyareena Salmisaari and
Ristikko grade boulders in Font and routes in French, so turning a boulder into a roped go would leave a
Font label under a French scale. Converting between the notations is the deferred conversion table, and
baking one in here would decide D17 by the back door. **So a go logged under the wrong discipline stays
wrong**, and that is a real residual cost rather than a technicality — it is worst at Tampereen
Kiipeilykeskus Nekala, which grades both disciplines in French, where the grid renders identical labels
either way and nothing on screen contradicts a wrong discipline. The hole is narrowed rather than open:
the logging screen re-seeds its discipline from the session's newest tick, so navigating away and back
no longer resets it. Closing it properly means forcing a grade re-pick on the new scale, and waits on
D17.

**Why per go, when the reported failure spanned several.** A bulk control has to invent a rule about
which goes it covers, and the same stale default may have been correct for some of them — guessing wrong
converts one wrong field into several. The cause is better attacked by making a non-default protection
more visible while logging, which is a separate change and a better one.

**Why the outcome is corrected whole.** `is_send` and `prior_experience` move together, through the same
six-cell grid the logging screen uses. Patching half a union is the operation that lets its halves
disagree, and a control reaching only `prior_experience` would leave a go recorded as not sent when it
was sent permanently wrong — the same category of mistake as the mis-tapped grade.

**What this changes:** the `tick-logging`, `sessions-view` and `local-database` capabilities, and
`apps/web/src/db/ticks.ts` plus the go sheet. No schema change: a correction writes the row shape the
logging path already writes.

**What would reverse it:** the discipline exclusion, once D17's conversion table exists or once a forced
grade re-pick is built. Per-go would be revisited only if a session's worth of corrections proves
common enough in use to outweigh inventing a scoping rule.
