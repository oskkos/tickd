import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HAPTIC_KEY,
  readHapticPreference,
  readThemePreference,
  resolveTheme,
  systemPrefersDark,
  THEME_KEY,
  watchSystemTheme,
  writeHapticPreference,
  writeThemePreference,
} from './preferences.ts';

beforeEach(() => {
  globalThis.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the theme preference', () => {
  it('defaults to following the system', () => {
    expect(readThemePreference()).toBe('system');
  });

  it('survives a write and a read', () => {
    writeThemePreference('light');
    expect(readThemePreference()).toBe('light');
  });

  it('falls back to the default when the stored value is not one of ours', () => {
    globalThis.localStorage.setItem(THEME_KEY, 'solarized');
    expect(readThemePreference()).toBe('system');
  });

  it('falls back to the default when storage throws', () => {
    // Firefox in private browsing, and storage disabled entirely. A settings screen that cannot render
    // because a preference is unreadable is a worse failure than a preference being wrong.
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    });

    expect(readThemePreference()).toBe('system');
    expect(() => {
      writeThemePreference('dark');
    }).not.toThrow();
  });
});

describe('the haptic preference', () => {
  it('defaults to on', () => {
    expect(readHapticPreference()).toBe(true);
  });

  it('survives being turned off and back on', () => {
    writeHapticPreference(false);
    expect(readHapticPreference()).toBe(false);
    writeHapticPreference(true);
    expect(readHapticPreference()).toBe(true);
  });

  it('treats an unrecognised value as on', () => {
    globalThis.localStorage.setItem(HAPTIC_KEY, 'maybe');
    expect(readHapticPreference()).toBe(true);
  });
});

describe('resolveTheme', () => {
  it('honours an explicit choice against the system', () => {
    expect(resolveTheme('light', true)).toBe('winter');
    expect(resolveTheme('dark', false)).toBe('dim');
  });

  it('follows the system when asked to', () => {
    expect(resolveTheme('system', true)).toBe('dim');
    expect(resolveTheme('system', false)).toBe('winter');
  });
});

describe('systemPrefersDark', () => {
  it('reads the media query', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn() }),
    );
    expect(systemPrefersDark()).toBe(false);
  });

  it('assumes dark where matchMedia is unavailable', () => {
    // Dark is the safer assumption: DESIGN.md §3 makes it the non-optional one, and gyms are dim.
    vi.stubGlobal('matchMedia', undefined);
    expect(systemPrefersDark()).toBe(true);
  });
});

describe('watchSystemTheme', () => {
  /** A `matchMedia` whose `change` listener the test can fire, standing in for the phone at sunset. */
  function stubMatchMedia() {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: (_: string, l: (event: MediaQueryListEvent) => void) => {
          listeners.add(l);
        },
        removeEventListener: (_: string, l: (event: MediaQueryListEvent) => void) => {
          listeners.delete(l);
        },
      }),
    );
    return {
      change(dark: boolean) {
        for (const listener of listeners) listener({ matches: dark } as MediaQueryListEvent);
      },
      get listenerCount() {
        return listeners.size;
      },
    };
  }

  it('follows a system change with no screen mounted', () => {
    // The reason this lives here rather than in `ThemeControl`: the control is mounted only on
    // `/settings`, and a phone flips to light while the climber is looking at the logging screen.
    const media = stubMatchMedia();
    document.documentElement.dataset.theme = 'dim';

    watchSystemTheme();
    media.change(false);

    expect(document.documentElement.dataset.theme).toBe('winter');
  });

  it('leaves an explicit choice alone', () => {
    // The preference is read inside the handler, so one subscription is correct for all three values.
    const media = stubMatchMedia();
    writeThemePreference('dark');

    watchSystemTheme();
    media.change(false);

    expect(document.documentElement.dataset.theme).toBe('dim');
  });

  it('unsubscribes, and is a no-op where there is no matchMedia', () => {
    const media = stubMatchMedia();
    const stop = watchSystemTheme();
    expect(media.listenerCount).toBe(1);
    stop();
    expect(media.listenerCount).toBe(0);

    vi.stubGlobal('matchMedia', undefined);
    expect(() => {
      watchSystemTheme()();
    }).not.toThrow();
  });
});
