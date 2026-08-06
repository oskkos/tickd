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

`_redirects` and `_headers` live in `apps/web/public/` and are copied into `dist` by the build, so they
need no Pages-side configuration.

**Never add a top-level `404.html`.** Cloudflare Pages falls back to `index.html` for unmatched paths
*only when the project has no `404.html`*. Adding one turns every unmatched route into a 404 —
including valid client-side routes — and `_redirects`' `/* /index.html 200` rule does not override it.
This was found the expensive way: deep links 404'd on a live preview while every other check passed.

## Origins

```
tickd.pages.dev                        production — the trial vehicle. Install from here.
<branch>.tickd.pages.dev               previews — a different origin, so they cannot read trial data.
feat-scaffold-phase-0.tickd.pages.dev  e.g. this change's preview
```

**Never install the PWA from a preview URL.** Its IndexedDB is a separate store, and a logbook opened
from the wrong origin looks empty rather than broken.

## Verifying a deployment

These are the behaviours the `web-deployment` spec requires, and the ones a Pages misconfiguration
breaks silently:

1. A client-side route requested directly returns the app shell, not 404.
2. `sw.js` responds with `Content-Type: application/javascript` and a revalidating `Cache-Control`.
   If it ever returns `text/html`, the SPA fallback has swallowed it and the service worker will not
   register at all — the PWA silently stops being installable and offline-capable.
3. A push to `develop` publishes to production; a push to any other branch publishes to a preview.

```sh
B=https://tickd.pages.dev
curl -sS -o /dev/null -w '%{http_code}\n' $B/some/client/route   # expect 200
curl -sSI $B/sw.js | grep -iE 'content-type|cache-control'       # expect javascript + no-cache
```

**Known gap: the `immutable` rule on `/assets/*` does not take effect.** Cloudflare returns its own
`public, max-age=0, must-revalidate` for those responses, even though the `/sw.js` rule in the same
`_headers` file *is* applied. The rule is kept because it is correct and costs nothing, but do not
assume it works. Practical impact is small — Vite fingerprints the filenames, so revalidation is a
304 rather than a re-download, and Cloudflare's edge cache still serves them. The `web-deployment`
spec only says assets MAY be cached long-term, so this is a missed optimisation rather than a
violation. Worth revisiting if it ever shows up in load times.

**Known trade-off:** with the SPA fallback enabled, a request for a *missing* file under `/assets/`
also returns `index.html` with a 200 rather than a 404. Cloudflare's asset model does not distinguish
navigation requests from subresource requests without a Pages Function, and a Worker is not worth
adding to Phase 0 for this. The practical consequence is that a broken deploy can look healthy to a
`curl` of an asset URL — so check item 2 above, which does catch it.
