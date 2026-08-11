## ADDED Requirements

### Requirement: Navigation is a bottom tab bar carrying only the tabs that exist

The shell SHALL present a tab bar fixed to the bottom of the viewport, listing one tab per shipped
top-level surface and no placeholders. In Phase 0 as of this change that is `Log` and `Sessions`;
`Flash` and `Settings` SHALL be added when those surfaces ship.

Bottom rather than top, because one-handed use puts primary controls in the lower thumb-reachable
third. No placeholders, because a disabled or empty tab implies the surface exists and is being
withheld.

#### Scenario: The bar shows the shipped tabs

- **WHEN** the app is opened
- **THEN** the tab bar shows exactly the tabs whose surfaces exist, and no disabled entries

#### Scenario: The current tab is identifiable

- **WHEN** a tab's surface is showing
- **THEN** that tab is marked as current, and not by colour alone

#### Scenario: The bar is reachable one-handed

- **WHEN** the app is opened on a 6.9" phone
- **THEN** every tab target falls within the lower thumb-reachable third of the viewport

### Requirement: Each top-level surface is a route

Each tab SHALL correspond to a distinct client-side route, and the session detail view SHALL be a route
carrying the session's id. Navigating between tabs SHALL update the address, and the platform back
gesture SHALL return to the previously shown surface rather than leaving the app.

An installed PWA has no browser back button, so back is a system gesture. With tab state held only in
React, that gesture exits the app from any tab — which reads as a crash rather than as navigation.

#### Scenario: Back returns to the previous surface

- **WHEN** the Sessions tab is opened from the Log tab and the back gesture is used
- **THEN** the Log tab is shown again and the app is not dismissed

#### Scenario: Back leaves the session detail for the list

- **WHEN** a session detail view is open and the back gesture is used
- **THEN** the Sessions list is shown

#### Scenario: A route survives a reload

- **WHEN** a tab's URL is loaded directly
- **THEN** that surface renders

## MODIFIED Requirements

### Requirement: The app shell works offline

A service worker SHALL precache the application shell — HTML, JS, CSS and fonts — so that a launch with
no network renders the UI rather than a browser error page. The precache SHALL answer navigation
requests for client-side routes, so that a route below the root opens offline rather than failing.

#### Scenario: Offline launch renders the shell

- **WHEN** the installed app is launched with the device offline, after at least one online visit
- **THEN** the app shell renders

#### Scenario: A route below the root opens offline

- **WHEN** a client-side route URL is opened with the device offline, after at least one online visit
- **THEN** the app shell is served from the precache and that route renders

#### Scenario: A new build supersedes the cached one

- **WHEN** a new version is deployed and the app is launched with network available
- **THEN** the app updates to the new build rather than remaining pinned to the cached one

#### Scenario: An update never reloads without consent

- **WHEN** a new service worker is waiting
- **THEN** the user is prompted, and the reload happens only when they accept it

An unrequested reload mid-session is indistinguishable from data loss in an app logged in fragments,
so `skipWaiting` SHALL be gated behind an explicit client message rather than called automatically.

Cloudflare's `_redirects` fallback answers an online deep link; it cannot answer one made offline, which
is why the service worker carries its own navigation fallback.

### Requirement: Physical interaction constraints hold in the shell

The shell SHALL establish the layout constraints that every later screen inherits: interactive targets
of 48–56 px, primary actions positioned in the lower thumb-reachable third of the viewport, and a
viewport configuration that prevents zoom-on-tap from interfering with rapid entry.

Chrome added to the shell SHALL be measured against the space the logging screen needs rather than
assumed to fit. The grade grid is a bounded scroll container with a floor of three rows, and the shell
is bounded to the viewport so that it can scroll at all; chrome that pushes the grid below its floor
breaks logging in order to decorate it.

#### Scenario: Touch targets meet the minimum

- **WHEN** any interactive element in the shell is measured
- **THEN** its touch target is at least 48 px in both dimensions

#### Scenario: Layout holds on the largest target device

- **WHEN** the app is opened on a 6.9" phone
- **THEN** primary actions fall within the lower third of the viewport and are reachable one-handed

#### Scenario: The grade grid keeps its floor with the tab bar present

- **WHEN** the logging screen is measured in a real browser at 412×600 with the tab bar rendered
- **THEN** the grade grid shows at least three rows of grades and scrolls within its own bounds, and
  the page itself does not scroll
