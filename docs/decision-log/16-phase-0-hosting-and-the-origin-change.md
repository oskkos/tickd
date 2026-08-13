---
id: D16
title: Phase 0 hosting written down; the origin change is accepted, not avoided
status: accepted
related: [D7, D8, D9, D15]
---

# D16 — Phase 0 hosting written down; the origin change is accepted, not avoided

**Considered:** a throwaway `*.pages.dev` origin with the origin changing at each phase — the
standing intention, though it had never been written down; registering the domain before the trial
and keeping one origin for the app's whole life; buying the name early as insurance but still
shipping Phase 0 on `*.pages.dev`; GitHub Pages; Netlify.

**Decided:** Cloudflare Pages on its free `*.pages.dev` subdomain, no custom domain, and the origin
change at Phase 1 accepted rather than designed around (§9.0).

**Phase 0 hosting was simply absent from this document.** §9 opened on Cloud Run, which is Phase 1's
architecture and needs a backend that does not exist yet, so nothing said where the PWA lives during
the month-long trial. The intent existed; the document didn't record it.

**The question turned out not to be "which host" but "how many origins this app has over its life."**
There are three — `*.pages.dev`, then `*.run.app` (§9.3), then a custom domain if a listing ever
forces one (§10.2). Two of those transitions are free: from Phase 1 onward Postgres is the recovery
source, so an orphaned IndexedDB is a cache that refills. Exactly one is not — Phase 0 → Phase 1,
which has no server-side copy behind it.

**That one move was already written off, which is what makes deferring safe.** D7 dropped the claim
path, so Phase 0 ticks were never going to reach a Phase 1 account regardless of hosting. The
single-origin alternative would have protected data that had already been spent.

**The single-origin alternative was genuinely close and was declined on scope, not on merit.** Its
Phase 0 cost really is only a domain purchase and a CNAME, and it has a second benefit unrelated to
data: §9.5 identifies the PWA bundle as the largest byte source, so serving it from Pages permanently
would keep it off Cloud Run's request budget. Against that, it front-loads a purchase and a
Cloudflare-in-front commitment into the phase whose stated main risk is scope discipline (§11), and it
would rewrite §9.3, §9.5 and §10.2 for a trial that has not yet passed its own exit criterion.
Deferring leaves all three sections standing. If the bundle-hosting argument later wins on its own
terms, that is a Phase 1 decision and belongs in its own entry.

Two costs are therefore accepted knowingly: **the name may be taken** by the time it is wanted — the
one cost of waiting that cannot be paid later — and **§10.2's precondition stays live**, so a domain
must still be fixed before any APK ships.

**Host choice inside Phase 0.** Not GitHub Pages: a project repo serves from a subpath, which adds
service-worker scope and `start_url` friction, on an origin shared with every other project of the
same account so their IndexedDB lands in the same bucket. Netlify is technically equivalent to Pages
but adds a vendor no other section names. Vercel was already declined (D8, D9). Pages also keeps the
vendor consistent with where §9.5 and §10.2 independently arrive.

**It also settled the importer question, in favour of building it.** An export with no importer is an
archive rather than a restore path — recovery means re-typing — and because the origin does move, that
file is the only thing bridging the Phase 0 → Phase 1 boundary. Deferring the importer to Phase 1 was
considered and rejected: it is roughly fifteen lines, it is the mitigation for §11's largest accepted
Phase 0 risk, and it is worth most at exactly the moment Phase 0 ends. **So both buttons ship in Phase
0** (§7.6), which supersedes D7's "export only".

**This is a deliberate, bounded addition to Phase 0 scope** — the one place this document has widened
rather than narrowed it — and it is fenced by two rules recorded in §7.6: import *replaces* rather than
merges, so no identity or conflict rules are invented ahead of Phase 1 (§8.3); and a schema-marker
mismatch is *refused* rather than upgraded, so no Dexie migration logic arrives through the back door.

**D7 still stands on the part that matters.** The bridge is manual and user-driven — export, move,
import. It is not the claim path, which would have had to associate anonymous local rows with a new
account automatically. Reinstating that would need its own entry.

**The trial device is Android (Galaxy S26 Ultra)**, which resolved the durability caveats in §7.6:
`persist()` is Chromium-only and does real work here, Safari's 7-day unused-data clear is irrelevant,
and `navigator.vibrate` is available so DESIGN §4's haptics work on the trial device. It also
surfaced a Galaxy-specific trap now recorded in §9.0 — Samsung Internet's storage is separate from
Chrome's, so the same origin opened in the other browser shows an empty logbook.

**What this changed:** §9.0 is new; §9.3, §9.5, §10.2 and D15 stand exactly as written. §7.6 gained a
JSON importer alongside the exporter, plus the two rules fencing it and the Chromium-only caveat on
`persist()`; §5's Phase 0 scope list and §11's eviction row follow from that. §10.5's third
open-option item is now explicitly still outstanding rather than satisfied, and §11 gained the
name-availability risk.
