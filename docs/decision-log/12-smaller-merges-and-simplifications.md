---
id: D12
title: Smaller merges and simplifications
status: accepted
related: [D1, D2]
---

# D12 — Smaller merges and simplifications

- **`attempt` merged into `tick` via `is_send`.** An attempt is a tick you didn't send: same shape,
  one boolean. One fewer table, and Phase 0 captures attempts for free.
- **`project` is a grouping key, not a route.** It only needs to link attempts to a send, and you
  create it by naming it, so identity is unambiguous. Phase 2.
- **`canonical_id` survives on `venue` only.** Merge pointers existed for route dedup (D2); venues
  still need them, at a volume you can moderate by hand.
- **Venues are curated plus user-submitted**, not free-form. Free-form would produce fifteen
  spellings of the same gym; pure curation would block anyone whose gym isn't listed, breaking the
  "any gym" promise from D1.
- **Venues are locations, not brands** — Kiipeilyareena's sites have different wall heights, which
  the vertical-metres metric depends on.
