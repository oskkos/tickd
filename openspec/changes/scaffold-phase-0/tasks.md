## 1. Workspace skeleton

- [x] 1.1 Add root `package.json` (private, no app dependencies) and `pnpm-workspace.yaml` declaring
      `apps/*` and `packages/*`
- [x] 1.2 Create `apps/web`, `packages/grade-spec` and `backend/`, each with a placeholder file so git
      tracks the empty ones
- [x] 1.3 Add `.gitignore` covering `node_modules`, `dist`, and editor/OS noise
- [x] 1.4 Add `.nvmrc` or a `packageManager` field pinning the Node and pnpm versions
- [x] 1.5 Verify `pnpm install` completes and `apps/web` resolves as a workspace member

## 2. Web app baseline

- [x] 2.1 Scaffold `apps/web` as Vite + React + TypeScript
- [x] 2.2 Enable TypeScript `strict` and confirm typecheck runs with no backend or generated code present
- [x] 2.3 Add ESLint and Prettier with a single shared config, wired to the workspace
- [x] 2.4 Add a test runner (Vitest) with one trivial rendering test so `just test` has something to run
- [x] 2.5 Confirm `pnpm dev` serves the app locally

## 3. UI stack

- [x] 3.1 Add Tailwind and daisyUI, configured with the `dim` and `winter` themes only
- [x] 3.2 Add `@base-ui/react` — not the deprecated `@base-ui-components/react`
- [x] 3.3 Set `data-theme` on `<html>` in `index.html`, with `dim` as the default
- [x] 3.4 Add a temporary theme switch and confirm a portalled Base UI dialog inherits the theme
- [x] 3.5 Subset and commit Poppins 600 and Lato 400 as `.woff2`, self-hosted, with `@font-face` and
      preload hints
- [x] 3.6 Apply tabular figures to a numeric sample and confirm no font request leaves the origin
- [x] 3.7 Build a placeholder shell screen that establishes 48–56 px targets and a lower-third primary
      action area

## 4. PWA installability

- [x] 4.1 Add `vite-plugin-pwa` and generate the web manifest — name, `start_url`, display standalone,
      theme and background colours
- [x] 4.2 Produce the icon set per `DESIGN.md` §2: maskable PNG 512 with artwork inside the centre 80%,
      and an opaque `apple-touch-icon` PNG 180
- [x] 4.3 Configure precaching of the app shell, including the committed fonts
- [x] 4.4 Configure service-worker registration to prompt on update rather than auto-reloading
- [x] 4.5 Verify the emitted manifest matches the icon geometry `DESIGN.md` §2 specifies
- [ ] 4.6 Confirm a production build passes Chrome's installability criteria locally

## 5. Build orchestration

- [x] 5.1 Add a root `justfile` with `install`, `dev`, `build`, `typecheck`, `lint`, `test`
- [x] 5.2 Confirm no target invokes Gradle, Flyway, jOOQ, Docker or OpenAPI generation
- [x] 5.3 Confirm every target succeeds on a clean checkout after install

## 6. Cloudflare Pages deployment

- [x] 6.1 Create the Pages project connected to the GitHub repository, production branch `develop`
- [x] 6.2 Set the build command and output directory, and confirm a clean-checkout build succeeds in
      Cloudflare's environment
- [x] 6.3 Add `_redirects` for SPA fallback and verify a deep link resolves. No top-level `404.html`:
      Pages only falls back to `index.html` in its absence. Missing assets return the shell (see spec)
- [x] 6.4 Add `_headers` so the service worker script is revalidated rather than long-cached, leaving
      fingerprinted assets long-lived
- [x] 6.5 Record the Pages settings — production branch, build command, output directory — in the
      repository so the configuration is reproducible
- [x] 6.6 Confirm a push to `develop` publishes, and that a branch push produces a preview on a separate
      hostname

## 7. Verify on the trial device

- [ ] 7.1 Open the production origin on the Galaxy S26 Ultra and install to the home screen
- [ ] 7.2 Launch from the home-screen icon and confirm it opens standalone with no browser UI
- [ ] 7.3 Confirm the launcher's icon mask does not crop the logo artwork
- [ ] 7.4 Enable airplane mode, launch, and confirm the shell and both fonts render offline
- [ ] 7.5 Deploy a visible change and confirm the installed app picks up the new build on next launch
- [ ] 7.6 Confirm primary actions fall in the lower thumb-reachable third on a 6.9" screen, one-handed
- [ ] 7.7 Note which browser the install came from, since Samsung Internet and Chrome keep separate
      storage and later data will live in whichever was used

## 8. Close out

- [x] 8.1 Re-read the `build-tooling` scope fence against the finished tree and confirm no Phase 1
      artifact crept in
- [x] 8.2 Record the chosen `*.pages.dev` hostname in the change notes — `tickd.pages.dev` (apps/web/DEPLOY.md)
- [x] 8.3 Commit, push to `develop`, and confirm the deployed origin matches the commit — verified:
      the deployed bundle hash `index-DeVOi_JK.js` equals the local build's
