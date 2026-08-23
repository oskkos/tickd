## MODIFIED Requirements

### Requirement: Navigation is a bottom tab bar carrying only the tabs that exist

The shell SHALL present a tab bar fixed to the bottom of the viewport, listing one tab per shipped
top-level surface and no placeholders. In Phase 0 as of this change that is `Log`, `Sessions`, `Flash` and
`Settings` — the four surfaces `CONCEPT.md` §"Phase 0" names, so the bar is complete and no tab remains
deferred.

Bottom rather than top, because one-handed use puts primary controls in the lower thumb-reachable
third. No placeholders, because a disabled or empty tab implies the surface exists and is being
withheld.

The bar's geometry SHALL be re-measured in a real browser at 412×600 when a tab is added. The grade grid's
three-row floor is pinned against the bar's height, and a fourth tab changes how labels and targets divide
the width — jsdom reports every height as zero and cannot distinguish a bar that fits from one that wraps.

#### Scenario: The bar shows the shipped tabs

- **WHEN** the app is opened
- **THEN** the tab bar shows exactly the tabs whose surfaces exist, and no disabled entries

#### Scenario: The current tab is identifiable

- **WHEN** a tab's surface is showing
- **THEN** that tab is marked as current, and not by colour alone

#### Scenario: The bar is reachable one-handed

- **WHEN** the app is opened on a 6.9" phone
- **THEN** every tab target falls within the lower thumb-reachable third of the viewport

#### Scenario: Four tabs still fit the bar

- **WHEN** the tab bar is measured in a real browser at 412×600 with all four Phase 0 tabs present
- **THEN** each tab's label renders on one line, every target keeps its touch size, and the grade grid on
  the logging screen still shows at least three rows

### Requirement: Each top-level surface is a route

Each tab SHALL correspond to a distinct client-side route, and the session detail view SHALL be a route
carrying the session's id. Navigating between tabs SHALL update the address, and the platform back
gesture SHALL return to the previously shown surface rather than leaving the app.

State held *within* a surface SHALL NOT be carried in the address. The flash-rate surface's selected
protection is the case in point: putting it in a search param would make the back gesture step backwards
through selector taps instead of leaving the surface, which contradicts the requirement above.

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

#### Scenario: Back leaves a surface rather than undoing in-surface state

- **WHEN** the protection selector on the flash-rate surface is changed and the back gesture is used
- **THEN** the previously shown surface is shown, rather than the previous selector state
