---
id: D9
title: Backend: Kotlin over Node, twice
status: accepted
related: [D8]
---

# D9 — Backend: Kotlin over Node, twice

**Considered:** Supabase (rejected in favour of owning the backend); then Node + Kysely + Neon on
Vercel, raised twice — once for interest and once explicitly to solve hosting.

**Decided:** Kotlin + Spring Boot + jOOQ.

The technical argument is that the analytics pillar is SQL-shaped — window functions, lateral joins,
`percentile_cont` — which is exactly jOOQ's sweet spot. Kysely is a healthy, genuine analogue
(0.29.2, May 2026, native window functions and CTEs) but `percentile_cont` needs a raw `sql` tag,
and jOOQ remains better here.

**The Node stack's cost advantage evaporated with D8.** Once scale-to-zero was on the table, Kotlin
on Cloud Run is also ~€0 with no ops. What remained were a simpler monorepo — one toolchain, and
§8.4's dual grade-spec codegen collapsing to one shared package — and a faster path to Phase 1. Real
advantages, but not decisive.

Also relevant: Vercel Hobby prohibits commercial use, explicitly including "being paid to
create/update/host the site" and even asking for donations, so Phase 3 as a real product would need
Pro at $20/month per developer.

The frontend, data model, grade spec and sync design are all backend-agnostic, so this stays cheap to
revisit.
