---
id: D15
title: Play Store is a channel, not a rewrite
status: accepted
related: []
---

# D15 — Play Store is a channel, not a rewrite

**Considered:** a native Android app; Capacitor wrapping both stores; a TWA; no store presence at
all.

**Decided:** a TWA if and when a listing happens, and no commitment now (§10).

A native app contradicts the whole local-first PWA architecture and would mean maintaining the
logbook twice. **Capacitor is the serious alternative:** it wraps any HTTPS URL in its own bundled
WebView — ~4 MB against a TWA's ~800 kB — and adds a plugin bridge, which buys the App Store and
native APIs, including the iOS haptics that `DESIGN.md` §4 currently records as unavailable. That
is a real advantage, but it costs a second build target and a second store relationship for a
product with no users, so it is the right thing to revisit if iOS distribution ever becomes a goal
rather than the right thing to choose now.

**The finding that matters is that the wrapper is not the binding constraint.** The two things that
decide whether a listing is worth having — a permanent custom domain fixed *before* publication
(§10.2), and an annual target-API rebuild for as long as the listing exists (§10.3) — apply
identically to every option on the list. Choosing TWA is the easy part; the cost is elsewhere.

**What this changed:** §9.3's "add a custom domain only when there are real users" gained an
exception, since a Play listing forces the decision earlier and makes it irreversible.
