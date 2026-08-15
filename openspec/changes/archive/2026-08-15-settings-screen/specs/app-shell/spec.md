## MODIFIED Requirements

### Requirement: Theming is applied at the document root

The active daisyUI theme SHALL be set via `data-theme` on the `<html>` element, never on a subtree, so
that portalled dialogs and drawers rendered outside the React root inherit it. The app SHALL support the
`dim` (dark) and `winter` (light) themes, and dark SHALL be available rather than optional.

The active theme SHALL follow a stored preference of *follow system*, dark, or light, defaulting to
following the system, and the stored choice SHALL be applied before the app's first paint rather than from a
React effect — otherwise every cold start paints one theme and then replaces it, which on a stored light
theme, or a dark system preference against a hard-coded default, is a visible flash of the wrong theme at
the moment the app is opened. The preference itself belongs to the `settings` capability; what this
requirement fixes is that the document root is where it lands, and that it lands there first.

#### Scenario: Portalled content is themed

- **WHEN** a Base UI dialog or drawer opens
- **THEN** its content renders with the same theme as the rest of the app

#### Scenario: Both themes are selectable

- **WHEN** the theme is switched
- **THEN** the document root's `data-theme` changes between `dim` and `winter` and the UI follows

#### Scenario: The stored theme is in force before first paint

- **WHEN** the app is loaded with a stored theme preference
- **THEN** the document root already carries the resulting theme when the app first paints

#### Scenario: Popups are not styled with daisyUI's modal classes

- **WHEN** a Base UI popup is styled
- **THEN** it does not carry `modal-box`

daisyUI ships `modal-box` at `opacity: 0` and reveals it only through a `.modal` parent's open state,
which Base UI deliberately does not provide. The result is an invisible popup with a working backdrop.

### Requirement: Navigation is a bottom tab bar carrying only the tabs that exist

The shell SHALL present a tab bar fixed to the bottom of the viewport, listing one tab per shipped
top-level surface and no placeholders. In Phase 0 as of this change that is `Log`, `Sessions` and
`Settings`; `Flash` SHALL be added when that surface ships.

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

### Requirement: Physical interaction constraints hold in the shell

The shell SHALL establish the layout constraints that every later screen inherits: interactive targets
of 48–56 px, primary actions positioned in the lower thumb-reachable third of the viewport, and a
viewport configuration that prevents zoom-on-tap from interfering with rapid entry.

Chrome added to the shell SHALL be measured against the space the logging screen needs rather than
assumed to fit. The grade grid is a bounded scroll container with a floor of three rows, and the shell
is bounded to the viewport so that it can scroll at all; chrome that pushes the grid below its floor
breaks logging in order to decorate it.

Chrome **removed** from the shell SHALL be measured on the same terms. The header's height is set by its
tallest touch target, so taking a control out of it changes the space the grade grid has — in the
favourable direction, but by an amount jsdom cannot report, since it measures every height as zero and
cannot distinguish a bounded scroll container from an unbounded one. A relaxed constraint is still a
changed one.

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

#### Scenario: A control leaving the header is re-measured

- **WHEN** a control is removed from the shell header
- **THEN** the grade grid is re-measured in a real browser at 412×600 and still scrolls within its own
  bounds while the page does not
