# app-shell

## Purpose

The installable, offline-capable PWA shell every screen is built inside: manifest, service worker,
icons, theming, typography, and the physical interaction constraints. Installability is also the
precondition for the distribution option in `CONCEPT.md` §10, so it must not regress silently.

## Requirements

### Requirement: The app is installable as a PWA

The web app SHALL meet Chrome's installability criteria: a served web manifest, a registered service
worker, and the icon set required for a home-screen install. Installability SHALL hold from Phase 0
onward, because it is also the precondition for the distribution option recorded in `CONCEPT.md` §10.

#### Scenario: Install prompt is offered on Android Chrome

- **WHEN** the deployed origin is opened in Chrome on Android
- **THEN** the browser offers to install the app to the home screen

#### Scenario: Installed app launches standalone

- **WHEN** the app is launched from its home-screen icon
- **THEN** it opens without browser UI, at the manifest's `start_url`

### Requirement: The app shell works offline

A service worker SHALL precache the application shell — HTML, JS, CSS and fonts — so that a launch with
no network renders the UI rather than a browser error page.

#### Scenario: Offline launch renders the shell

- **WHEN** the installed app is launched with the device offline, after at least one online visit
- **THEN** the app shell renders

#### Scenario: A new build supersedes the cached one

- **WHEN** a new version is deployed and the app is launched with network available
- **THEN** the app updates to the new build rather than remaining pinned to the cached one

#### Scenario: An update never reloads without consent

- **WHEN** a new service worker is waiting
- **THEN** the user is prompted, and the reload happens only when they accept it

An unrequested reload mid-session is indistinguishable from data loss in an app logged in fragments,
so `skipWaiting` SHALL be gated behind an explicit client message rather than called automatically.

### Requirement: Icons follow the platform rules for each target

The icon set SHALL include a maskable PNG 512 whose artwork sits inside the centre 80% safe zone with
the background bled to the edges, and an `apple-touch-icon` PNG 180 with an opaque background baked in.

#### Scenario: Maskable icon survives circular cropping

- **WHEN** the app is installed on Android and the launcher applies its own icon mask
- **THEN** no part of the logo artwork is cropped

### Requirement: Theming is applied at the document root

The active daisyUI theme SHALL be set via `data-theme` on the `<html>` element, never on a subtree, so
that portalled dialogs and drawers rendered outside the React root inherit it. The app SHALL support the
`dim` (dark) and `winter` (light) themes, and dark SHALL be available rather than optional.

#### Scenario: Portalled content is themed

- **WHEN** a Base UI dialog or drawer opens
- **THEN** its content renders with the same theme as the rest of the app

#### Scenario: Both themes are selectable

- **WHEN** the theme is switched
- **THEN** the document root's `data-theme` changes between `dim` and `winter` and the UI follows

#### Scenario: Popups are not styled with daisyUI's modal classes

- **WHEN** a Base UI popup is styled
- **THEN** it does not carry `modal-box`

daisyUI ships `modal-box` at `opacity: 0` and reveals it only through a `.modal` parent's open state,
which Base UI deliberately does not provide. The result is an invisible popup with a working backdrop.

### Requirement: Typography is self-hosted

Poppins 600 for headings and Lato 400 for body text SHALL be served from `.woff2` files committed to
this repository. No font SHALL be requested from a third-party CDN. Numeric columns SHALL use tabular
figures.

#### Scenario: No third-party font requests

- **WHEN** the app loads with the network inspected
- **THEN** no request is made to any font CDN

#### Scenario: Fonts are available offline

- **WHEN** the app is launched offline after one online visit
- **THEN** headings and body text render in Poppins and Lato rather than fallback faces

### Requirement: Physical interaction constraints hold in the shell

The shell SHALL establish the layout constraints that every later screen inherits: interactive targets
of 48–56 px, primary actions positioned in the lower thumb-reachable third of the viewport, and a
viewport configuration that prevents zoom-on-tap from interfering with rapid entry.

#### Scenario: Touch targets meet the minimum

- **WHEN** any interactive element in the shell is measured
- **THEN** its touch target is at least 48 px in both dimensions

#### Scenario: Layout holds on the largest target device

- **WHEN** the app is opened on a 6.9" phone
- **THEN** primary actions fall within the lower third of the viewport and are reachable one-handed
