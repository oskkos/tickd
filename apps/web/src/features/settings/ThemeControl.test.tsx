import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeControl } from './ThemeControl.tsx';
import { THEME_KEY } from './preferences.ts';

/** A `matchMedia` whose `change` listener the test can fire, standing in for the phone at sunset. */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches,
      addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      },
    }),
  );
  return {
    change(dark: boolean) {
      for (const listener of listeners) {
        listener({ matches: dark } as MediaQueryListEvent);
      }
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

beforeEach(() => {
  globalThis.localStorage.clear();
  document.documentElement.dataset.theme = 'dim';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ThemeControl', () => {
  it('offers the three choices with the stored one pressed', () => {
    stubMatchMedia(true);
    globalThis.localStorage.setItem(THEME_KEY, 'light');

    render(<ThemeControl />);

    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'false');
    // The stored choice wins over the system, which asks for dark here.
    expect(document.documentElement.dataset.theme).toBe('winter');
  });

  it('persists a choice so it survives a remount', async () => {
    stubMatchMedia(true);
    const { unmount } = render(<ThemeControl />);

    await userEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(document.documentElement.dataset.theme).toBe('winter');

    unmount();
    render(<ThemeControl />);

    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.theme).toBe('winter');
  });

  it('follows a system change without a reload', () => {
    const media = stubMatchMedia(true);
    render(<ThemeControl />);
    expect(document.documentElement.dataset.theme).toBe('dim');

    media.change(false);

    expect(document.documentElement.dataset.theme).toBe('winter');
  });

  it('does not follow the system once a theme is chosen explicitly', async () => {
    // The difference between choosing a theme and choosing to follow one: an explicit dark must not
    // turn light when the phone's own schedule flips at sunrise.
    const media = stubMatchMedia(true);
    render(<ThemeControl />);

    await userEvent.click(screen.getByRole('button', { name: 'Dark' }));
    media.change(false);

    expect(document.documentElement.dataset.theme).toBe('dim');
  });

  it('renders the default when the stored value is unrecognised', () => {
    stubMatchMedia(false);
    globalThis.localStorage.setItem(THEME_KEY, 'not-a-theme');

    render(<ThemeControl />);

    expect(screen.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.theme).toBe('winter');
  });
});
