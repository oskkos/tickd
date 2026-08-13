---
id: D8
title: Hosting: the "no scale-to-zero" requirement was wrong
status: accepted
related: []
---

# D8 — Hosting: the "no scale-to-zero" requirement was wrong

**Considered, in order:** Supabase; then an always-on VPS (Hetzner Helsinki €6/mo, UpCloud Helsinki
€15/mo with managed Postgres); then hyperscalers; then Cloud Run with scale-to-zero.

**Decided:** Cloud Run `europe-north1` scale-to-zero + Neon, ~€0.

The requirement that ruled out serverless was "JVM cold starts of several seconds would hit the sync
endpoint." **That was wrong, and it was the single constraint forcing an always-on server.** The app
is local-first: sync is a background outbox flush, so the user never waits on the network and a
two-second cold start is invisible. The only user-facing synchronous path is the OAuth redirect,
which the JDK 25 AOT cache handles (0.27 s in a published sample).

Two contributing facts: Cloud Run's free tier **does** cover `europe-north1` (unlike the Compute
Engine and Cloud Storage free tiers, which are US-only), and Hetzner's cheap CX line turned out to be
supply-constrained and unavailable, after two 2026 price rises.

**Neon was rejected and then adopted**, which is worth recording. The objection was real: HikariCP
holds open connections, so on an always-on server Neon never scales to zero and burns ~182 CU-hours
against a 100-hour free allowance. On Cloud Run the *instance* scales to zero, so the pool
disappears with it and the two idle in step. The mismatch was an artifact of the always-on
assumption, not of Neon.
