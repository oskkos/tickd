import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HAPTIC_KEY,
  readHapticPreference,
  readThemePreference,
  resolveTheme,
  systemPrefersDark,
  THEME_KEY,
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
