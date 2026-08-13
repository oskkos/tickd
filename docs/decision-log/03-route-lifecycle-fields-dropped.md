---
id: D3
title: Route lifecycle fields dropped entirely
status: accepted
related: [D2]
---

# D3 — Route lifecycle fields dropped entirely

**Considered:** `set_at` / `removed_at` on routes; then `first_seen_at` / `last_seen_at` written
automatically by the app, plus a "this sector was re-set" bulk action and a staleness window for a
derived "currently up" query.

**Decided:** none of it. The fields existed to keep a route inventory accurate, and D2 removed the
inventory. A tick records the grade you climbed on the day you climbed it, and that fact never
expires.

Worth noting the original `set_at` / `removed_at` were unimplementable anyway: nobody tells you when
a route was set or stripped, there's no gym API, and asking users to mark routes as stripped is
friction they'd never accept. "Gym ticklists rot within months" turned out to be a self-inflicted
problem.
