# Deployment — Cloudflare Pages

Phase 0 hosting is specified in `CONCEPT.md` §9.0 and D16: **Cloudflare Pages on its free
`*.pages.dev` subdomain, no custom domain, and the origin is expected to change at Phase 1.**

The Cloudflare account and project are out-of-repo state. These are the settings, recorded so the
configuration is reproducible even though the account is not.

## Project settings

| Setting                | Value                                                              |
| ---------------------- | ------------------------------------------------------------------ |
| Git repository         | `oskkos/tickd`                                                     |
| Production branch      | `develop`                                                          |
| Framework preset       | None                                                               |
| Build command          | `pnpm install --frozen-lockfile && pnpm --filter @tickd/web build` |
| Build output directory | `apps/web/dist`                                                    |
| Root directory         | repository root (the build is a workspace build)                   |
| Node version           | 24 — set `NODE_VERSION=24` if Pages does not read `.nvmrc`         |
| Custom domain          | **None.** Deliberate (D16).                                        |
| Preview deployments    | Enabled for all non-production branches                            |

`_redirects`, `_headers` and `404.html` live in `apps/web/public/` and are copied into `dist` by the
build, so they need no Pages-side configuration.

## Origins

```
<project>.pages.dev            production — the trial vehicle. Install from here.
<hash>.<project>.pages.dev     previews — a different origin, so they cannot read trial data.
```

**Never install the PWA from a preview URL.** Its IndexedDB is a separate store, and a logbook opened
from the wrong origin looks empty rather than broken.

The production hostname is recorded in the change notes once the project exists.

## Verifying a deployment

These are the behaviours the `web-deployment` spec requires, and the ones a Pages misconfiguration
breaks silently:

1. A client-side route requested directly returns the app shell, not 404.
2. A missing file under `/assets/` returns **404**, not the shell with a 200.
3. `sw.js` responds with `Cache-Control: no-cache`.
4. Files under `/assets/` respond `immutable`.
5. A push to `develop` publishes to production; a push to any other branch publishes to a preview.

Item 2 depends on Cloudflare applying `_redirects` only to requests that miss a static asset. Confirm
it against the live deployment rather than assuming it.
