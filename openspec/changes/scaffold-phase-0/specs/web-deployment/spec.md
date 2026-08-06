## ADDED Requirements

### Requirement: Phase 0 is served from Cloudflare Pages on a throwaway origin

The built web app SHALL be served over HTTPS from Cloudflare Pages using its free `*.pages.dev`
subdomain. No custom domain SHALL be registered or configured in Phase 0, and the origin is expected to
change at Phase 1 (`CONCEPT.md` §9.0, D16).

#### Scenario: The trial origin serves over HTTPS

- **WHEN** the production URL is opened on a phone
- **THEN** it is served over HTTPS, satisfying the secure-context requirement for service workers,
  `navigator.storage.persist()` and Add-to-Home-Screen

#### Scenario: No custom domain is configured

- **WHEN** the Pages project configuration is inspected
- **THEN** no custom domain is attached

### Requirement: Deployment is triggered from the default branch

The Pages project SHALL treat `develop` as its production branch. Every other branch SHALL produce a
preview deployment on a distinct hostname.

#### Scenario: A push to develop deploys production

- **WHEN** a commit is pushed to `develop`
- **THEN** Cloudflare Pages builds it and publishes to the production `*.pages.dev` hostname

#### Scenario: Preview deployments are isolated

- **WHEN** a branch other than `develop` is pushed
- **THEN** it is published to a preview hostname, which is a separate origin and therefore cannot read
  the trial device's stored data

### Requirement: Client-side routes resolve

The deployment SHALL serve `index.html` for paths that do not correspond to a static asset, so that
deep links and a manifest `start_url` below the root resolve instead of returning 404.

#### Scenario: A deep link loads the app

- **WHEN** a client-side route URL is requested directly
- **THEN** the app shell is served and the route renders

#### Scenario: A missing asset still 404s

- **WHEN** a request is made for a nonexistent file with an asset extension
- **THEN** the response is 404 rather than the app shell

### Requirement: Cache headers do not pin clients to a stale build

The service worker script SHALL NOT be served with a long-lived cache lifetime. Fingerprinted build
assets MAY be cached long-term.

#### Scenario: The service worker is revalidated

- **WHEN** the response headers for the service worker script are inspected
- **THEN** its cache lifetime requires revalidation rather than allowing a long-lived cached copy

#### Scenario: A deploy reaches an already-installed client

- **WHEN** a new build is deployed and an installed client is launched with network available
- **THEN** the client picks up the new service worker rather than continuing to serve the previous build
  indefinitely

### Requirement: The build is reproducible in CI without local tooling

The Pages build SHALL run from the repository using pnpm, requiring no Docker, database, or generated
code, so a clean checkout builds successfully.

#### Scenario: Clean-checkout build succeeds

- **WHEN** Cloudflare Pages builds a commit from a clean clone
- **THEN** install and build complete without requiring services beyond the pnpm registry
