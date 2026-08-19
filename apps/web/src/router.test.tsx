import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from './testing/renderApp.tsx';

/** The tab bar's links, in render order. */
function tabs() {
  return within(screen.getByTestId('tab-bar')).getAllByRole('link');
}

describe('the tab bar', () => {
  it('shows exactly the surfaces that exist', async () => {
    await renderApp();

    // All four Phase 0 surfaces ship as of the flash-rate chart, so the bar is complete. The rule the
    // list encodes outlives that: a tab appears when its surface does, never before, because a disabled
    // one would claim the surface exists and is being withheld.
    expect(tabs().map((t) => t.textContent)).toEqual(['Log', 'Sessions', 'Flash', 'Settings']);
  });

  it('offers nothing disabled or inert', async () => {
    await renderApp();

    for (const tab of tabs()) {
      expect(tab).not.toHaveAttribute('aria-disabled');
      expect(tab).not.toHaveAttribute('disabled');
    }
  });

  it('marks the current tab, and not by colour alone', async () => {
    await renderApp();

    const [log, sessions] = tabs();
    // `aria-current` rather than a class: it is what a screen reader reports and what the indicator
    // rule is drawn from, so the mark and the semantics cannot drift apart.
    expect(log).toHaveAttribute('aria-current', 'page');
    expect(sessions).not.toHaveAttribute('aria-current');
  });

  it('marks only the tab you are on, even though `/` prefixes every path', async () => {
    await renderApp({ initialPath: '/sessions' });

    const [log, sessions] = tabs();
    expect(log).not.toHaveAttribute('aria-current');
    expect(sessions).toHaveAttribute('aria-current', 'page');

    // Honest about what this does and does not guard: it holds with the Log tab's `exact` flag either
    // way, because TanStack's inexact match requires a whole path segment. Kept as a statement of the
    // behaviour the bar promises, not as a guard on that flag — the flag that *is* guarded is the
    // Sessions tab's, below.
  });

  it('keeps Sessions marked while a session detail is open', async () => {
    await renderApp({ initialPath: '/sessions/abc123' });

    // The detail is somewhere you went *from* the list, not a fourth place — so the list's tab stays
    // lit. This is why the Sessions tab is deliberately not `exact`.
    const [, sessions] = tabs();
    expect(sessions).toHaveAttribute('aria-current', 'page');
  });

  it('meets the touch-target floor', async () => {
    await renderApp();

    // Chalky fingers: `DESIGN.md` §4 puts the floor above the 44px minimum. Asserted as the class that
    // sets it, because jsdom has no layout engine to measure.
    for (const tab of tabs()) {
      expect(tab).toHaveClass('min-h-touch');
    }
  });
});

describe('navigation', () => {
  it('reaches the Sessions surface and comes back to logging', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByRole('link', { name: /sessions/i }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Sessions' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /log/i }));
    // Back on the logging route, which with no open session is the venue picker.
    expect(await screen.findByRole('heading', { name: /where are we/i })).toBeInTheDocument();
  });

  it('starts on the logging screen, because `start_url` is baked into every install', async () => {
    await renderApp({ initialPath: '/' });

    expect(await screen.findByRole('heading', { name: /where are we/i })).toBeInTheDocument();
  });

  it('reaches the Flash surface from the tab bar', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByRole('link', { name: /flash/i }));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Flash rate' }),
    ).toBeInTheDocument();
  });

  it('renders the Flash surface when its URL is loaded directly', async () => {
    // `app-shell` requires a route to survive a reload: an installed PWA restores the last URL, so a
    // surface reachable only by tapping through from `/` would come back blank.
    await renderApp({ initialPath: '/flash' });

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Flash rate' }),
    ).toBeInTheDocument();
  });

  it('matches the detail route and reads its param', async () => {
    await renderApp({ initialPath: '/sessions/session-42' });

    // "Not found" is the right answer with no such row, and it is only reachable by the route having
    // matched *and* the screen having queried with the param. That the param is the correct id is
    // asserted where a session is actually seeded — see `SessionDetailScreen.test.tsx`.
    expect(await screen.findByRole('heading', { name: /session not found/i })).toBeInTheDocument();
  });
});
