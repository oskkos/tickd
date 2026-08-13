---
id: D22
title: TanStack Router in Phase 0; the family is the lean, but not TanStack Query
status: accepted
related: []
---

# D22 — TanStack Router in Phase 0; the family is the lean, but not TanStack Query

**Considered:** no router at all (a `useState` tab plus a hand-rolled `popstate` listener);
`react-router`; TanStack Router with file-based routing; TanStack Router with routes written by hand.

**Decided:** `@tanstack/react-router`, routes written by hand. **The TanStack family is the default
lean for future client-side needs** — but adopting the router is not adopting the family wholesale, and
**TanStack Query is explicitly not Phase 0**.

**Why a router at all.** §5 keeps Phase 0 to a handful of surfaces, and for one screen the dependency
was not worth it — `apps/web/src/App.tsx` said so in a comment. The session list is the second screen,
and the deciding argument is not tab state but the **back gesture**: an installed PWA has no browser
back button, so back is a system gesture, and with the current tab held only in React it exits the app
from any tab. That reads as a crash rather than as navigation. A hand-rolled `popstate` listener could
answer it in about twenty lines, and the reason not to is that hand-rolled history integration fails
quietly — duplicate entries, a back stack that grows per tap — in ways a test does not catch and a
thumb does.

**Why this router.** Type-safe route params: the session detail carries a session id, and `useParams`
checks it against the real route tree, so a typo fails the build rather than rendering an empty screen.
`react-router` is the more conventional buy and would work; the tiebreak is that this is the family the
project intends to grow into, which makes the dependency the point rather than the cost.

**Routes are written by hand, not generated.** File-based routing needs `@tanstack/router-plugin` and
emits a `routeTree.gen.ts`. §8.4's convention is that generated code *is* committed, so that file would
be — enlisting the drift check, the pre-commit hook and CI for every future edit to a tree of three
routes. The generated form earns its keep at a scale Phase 0 is nowhere near.

**Why Query is a different question, and the distinction is the point of this entry.** The two ship
from the same family and would otherwise be adopted together on momentum. TanStack Query manages
*server* state — a cache in front of an authority that lives elsewhere. §8.3 makes the **client the
source of truth**: Dexie serves every read directly, and in Phase 0 there is no network at all. A query
cache here would be a second copy of the authority with nothing to reconcile it against, and its
invalidation model would be solving a problem this architecture does not have. Reactivity, where it is
wanted, is `dexie-react-hooks`, which observes IndexedDB — the authority itself — so a write shows up
without an invalidation step.

Phase 1 is where Query earns its place: a real backend, an outbox, a pull cursor, `401` as
pause-and-reauthenticate. The `build-tooling` scope fence names server-state libraries alongside HTTP
and auth clients so this cannot drift in early by accident.

**What would reverse it:** routing needs that outgrow three static routes and one param would not
reverse anything — that is the router doing its job. Query becomes right when there is a server to
query, which is Phase 1 by definition.
