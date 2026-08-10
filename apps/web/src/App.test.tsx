import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { renderApp } from './testing/renderApp.tsx';

describe('App shell', () => {
  it('renders the app name', async () => {
    await renderApp();
    expect(screen.getByRole('heading', { level: 1, name: 'tickd' })).toBeInTheDocument();
  });

  it('offers a theme switch', async () => {
    await renderApp();
    expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument();
  });

  it('shows the logging flow rather than a placeholder', async () => {
    await renderApp();
    expect(await screen.findByRole('heading', { name: /where are we/i })).toBeInTheDocument();
  });

  it('bounds itself to the viewport, so an inner region can be the scroller', async () => {
    const { container } = await renderApp();
    const shell = container.firstElementChild;

    // `min-h-dvh` grew with its content, which left the grade grid unbounded: it rendered at its full
    // natural height, so `overflow-y-auto` had nothing to scroll and the effect that positions it at
    // the climber's working range wrote `scrollTop` into a container that could not scroll. The page
    // scrolled instead and the range sat below the fold. Measured in a real browser, not here —
    // jsdom reports every height as 0, so this guards the cause rather than the symptom.
    expect(shell).toHaveClass('h-dvh');
    expect(shell).not.toHaveClass('min-h-dvh');
    expect(screen.getByRole('main')).toHaveClass('min-h-0');
  });

  it('keeps the tab bar out of the region that scrolls', async () => {
    await renderApp();

    // The bar is a sibling of `main` and does not shrink, so its height comes out of `main` rather
    // than overflowing a shell bounded to the viewport. What yields is the grade grid, which has a
    // floor — and whether that floor survives is measured in a real browser, not here.
    const bar = screen.getByTestId('tab-bar');
    expect(bar).toHaveClass('shrink-0');
    expect(bar.parentElement).toBe(screen.getByRole('main').parentElement);
  });
});

describe('daisyUI traps', () => {
  it('uses the invisible daisyUI popup class nowhere in the source', async () => {
    // The guard CLAUDE.md points at, widened. daisyUI 5 ships this class at opacity:0 / scale:.95 and
    // only reveals it through a `.modal` parent's open state, which Base UI deliberately does not
    // provide — the result is an invisible dialog with a working backdrop, reading as a rendering bug
    // rather than a CSS one. Scanning the source beats asserting it on one component, since the trap
    // applies to every popup anyone adds later.
    //
    // The needle is assembled at runtime so this file does not match itself, which lets the scan
    // cover test files too.
    const needle = ['modal', 'box'].join('-');
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');

    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (/\.tsx?$/.test(entry) && readFileSync(full, 'utf8').includes(needle)) {
          offenders.push(full);
        }
      }
    };
    walk('src');

    expect(offenders).toEqual([]);
  });
});

describe('storage warning', () => {
  it('says nothing when storage is ready', async () => {
    await renderApp({ startup: { status: 'ready' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('tells the user the logbook cannot save when storage is unavailable', async () => {
    await renderApp({ startup: { status: 'unavailable' } });
    // An empty venue picker with no message reads as data loss. Saying so is the whole point.
    expect(screen.getByRole('alert')).toHaveTextContent(/will not let tickd store anything/i);
  });

  it('mentions a session that was closed for you, rather than closing it silently', async () => {
    await renderApp({
      startup: {
        status: 'ready',
        lazyClose: { closed: true, outcome: 'ended', dateLocal: '2026-08-04' },
      },
    });
    expect(screen.getByRole('status')).toHaveTextContent(/closed your session from 2026-08-04/i);
  });

  it('says nothing when no session was closed', async () => {
    await renderApp({ startup: { status: 'ready' } });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('names the likely cause on a timeout, since it is user-fixable', async () => {
    await renderApp({ startup: { status: 'timeout' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/another tab/i);
  });

  it('shows the boot notices on whichever surface the app opened on', async () => {
    // They are shell-level facts about whether the database works at all, so they cannot live inside
    // the logging screen — landing on Sessions with storage broken would say nothing.
    await renderApp({ startup: { status: 'unavailable' }, initialPath: '/sessions' });

    expect(screen.getByRole('alert')).toHaveTextContent(/will not let tickd store anything/i);
  });
});

describe('the wordmark', () => {
  it('is the heading, so the visible name and the accessible one are one string', async () => {
    await renderApp();

    expect(screen.getByRole('heading', { level: 1, name: 'tickd' })).toBeInTheDocument();
  });

  it('ships both theme variants, since the fills are hardcoded rather than currentColor', async () => {
    await renderApp();

    // The climber and the k are two different colours, so one paintable path was never an option —
    // switching themes means switching files (ICONS.md).
    expect(screen.getByTestId('logo-dark')).toBeInTheDocument();
    expect(screen.getByTestId('logo-light')).toBeInTheDocument();
  });

  it('exposes only one of them to assistive tech', async () => {
    await renderApp();

    // Both are in the DOM because the swap is CSS; only one should be announced.
    expect(screen.getByTestId('logo-light')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('logo-dark')).not.toHaveAttribute('aria-hidden');
  });
});
