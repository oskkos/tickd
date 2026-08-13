---
id: D19
title: `tick.venue_id` dropped; a tick reaches its venue through its session
status: accepted
related: [D7]
---

# D19 — `tick.venue_id` dropped; a tick reaches its venue through its session

**Considered:** keeping the column because IndexedDB has no joins, so "all ticks at this venue" is one
indexed query with it and two round trips without; keeping it in case a tick can ever exist without a
session.

**Decided:** dropped, along with its index. A tick reaches its venue through `session_id`.

**The test that decided it is the one `date_local` passes and `venue_id` fails.** Both are duplicated
from the session, so both look like the same redundancy — but a tick's local date genuinely can differ
from its session's. Start at 22:40, log at 00:15, and the tick belongs to Saturday while the session
began on Friday; §7.7 already requires that a climb belong to the local day it was climbed. There is no
equivalent case for venue: a tick cannot be at a different gym from the session containing it. One
duplication carries information, the other only carries risk.

**The risk is specific, not theoretical.** §8.3 specifies plain `UPDATE` with last-write-wins **per
field** and no tombstones. Two rows holding the same fact are exactly what that pulls apart — correct
the venue on one device and on another, and `session.venue_id` and `tick.venue_id` can disagree with
nothing able to detect it. §7.5's `canonical_id` merging has the same shape: repointing a merged venue
would have to touch both tables and could half-succeed.

**Phase 0 never reads it.** Flash rate groups by `(discipline, grade_scale)` and does not touch venue.
The metric that would — vertical metres via `venue.default_route_length_m` — is a later phase and needs
a venue lookup regardless. Until then the column was written, indexed, and read by nothing.

**The precondition is that a tick always has a session**, which the venue-selection flow guarantees:
the venue has to be chosen before the first tick, and that choice is what opens the session. If ticks
ever become session-less, `session_id` stops being a total function to venue and this reverses.

**The cost is accepted:** a venue-scoped query becomes `sessions.where('venue_id')` then
`ticks.where('session_id').anyOf(...)` — two steps, hand-written, because Dexie has no joins. No Phase 0
query needs it, and Phase 1's Postgres joins for free.

**D7 is why this is cheap now.** Phase 0 data is disposable and there are no migrations, so removing a
column is the wipe-and-restart already accepted. That argues for dropping a field whose only current job
is staying in sync with another field, rather than carrying it until a query justifies it.

**What would reverse it:** ticks that can exist without a session, or a venue-scoped query hot enough
that two round trips matter.

**What this changes:** §7.7's `tick` block, the `local-database` capability's index requirement,
`apps/web/src/db/types.ts` and the `ticks` store definition. The schema marker moves on its own —
deriving it from the store definitions and the field list is exactly what makes a dropped column
announce itself.
