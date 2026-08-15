/**
 * The two device preferences, and the only `localStorage` in the app.
 *
 * **They are not in Dexie, and that is the decision rather than a shortcut.** Phase 0 has three tables
 * and a schema marker derived from their shape (`CONCEPT.md` §7.7, D7): a fourth table would move the
 * marker, and — because the export carries every table — would put a device's appearance inside a file
 * whose job is carrying a logbook across the Phase 1 origin change (§9.0). An export is a logbook, not a
 * device image.
 *
 * The consequence is stated rather than discovered: **what lives here is outside export, outside import
 * and outside deletion.** Deleting the logbook leaves the theme where it was, because the theme was never
 * part of the logbook.
 *
 * Two keys is the whole store. If preferences ever outgrow that, the question changes shape anyway at
 * Phase 1, when there is a user to attach them to.
 *
 * Every read is total: a missing key, an unrecognised value, or a `localStorage` that throws — Firefox in
 * private browsing, storage disabled entirely — all resolve to the default. A settings screen that cannot
 * render because a preference is unreadable would be a worse failure than the preference being wrong.
 */

/** What the user chose. `system` is the default: a phone in a dim gym is already in dark mode. */
export type ThemePreference = 'system' | 'dark' | 'light';

/** What `data-theme` is actually set to. daisyUI's two themes, per `DESIGN.md` §3. */
export type Theme = 'dim' | 'winter';

export const THEME_KEY = 'tickd.theme';
export const HAPTIC_KEY = 'tickd.haptic';

const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'dark', 'light'];

/** Reads a key, treating every failure as absence. */
function read(key: string): string | undefined {
  try {
    return globalThis.localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Writes a key, treating every failure as a no-op. A preference is not worth an error dialog. */
function write(key: string, value: string): void {
  try {
    globalThis.localStorage.setItem(key, value);
  } catch {
    /* Storage is unavailable; the choice applies for this session and is not remembered. */
  }
}

export function readThemePreference(): ThemePreference {
  const stored = read(THEME_KEY);
  return THEME_PREFERENCES.find((p) => p === stored) ?? 'system';
}

export function writeThemePreference(preference: ThemePreference): void {
  write(THEME_KEY, preference);
}

/** Haptics default **on**: `DESIGN.md` §4 wants them, and the trial device supports them. */
export function readHapticPreference(): boolean {
  return read(HAPTIC_KEY) !== 'off';
}

export function writeHapticPreference(enabled: boolean): void {
  write(HAPTIC_KEY, enabled ? 'on' : 'off');
}

/**
 * The preference plus the system's answer, resolved to the theme that gets applied.
 *
 * Kept as a pure function because two things resolve it and they must agree: this module, and the
 * pre-paint script in `index.html` that runs before any of this is loaded.
 */
export function resolveTheme(preference: ThemePreference, prefersDark: boolean): Theme {
  if (preference === 'dark') return 'dim';
  if (preference === 'light') return 'winter';
  return prefersDark ? 'dim' : 'winter';
}

/**
 * The dark-mode media query, or `undefined` where there is none.
 *
 * The DOM lib declares `matchMedia` as always present, which overstates reality the same way
 * `navigator.storage` does in `db/persist.ts` — so the type is widened here rather than the guard being
 * written as dead code the linter strips.
 */
export function darkMediaQuery(): MediaQueryList | undefined {
  const { matchMedia } = globalThis as Omit<typeof globalThis, 'matchMedia'> & {
    matchMedia?: typeof globalThis.matchMedia;
  };
  return typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : undefined;
}

/** Whether the system asks for dark. Assumes dark where it cannot ask: gyms are dim (`DESIGN.md` §3). */
export function systemPrefersDark(): boolean {
  return darkMediaQuery()?.matches ?? true;
}

/** Applies a theme to the document root — never to a subtree, since Base UI portals escape it. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

/**
 * Keeps `data-theme` in step with the system, and returns the unsubscribe.
 *
 * **It reads the preference inside the handler rather than capturing it when subscribing**, so one
 * subscription is correct for all three values: an explicit dark or light resolves to itself and the
 * event changes nothing, while *follow system* tracks it. That is the difference between choosing a
 * theme and choosing to follow one, expressed once instead of as a conditional subscription.
 *
 * **Started at boot, not by `ThemeControl`.** The control is mounted only while the settings screen is
 * on screen, and a phone whose schedule flips at sunset does it while the climber is looking at the
 * logging screen — so a subscription tied to the control satisfies the spec's "without a reload" only
 * on the one surface nobody is on.
 */
export function watchSystemTheme(): () => void {
  const query = darkMediaQuery();
  if (!query) {
    return () => undefined;
  }
  const onChange = (event: MediaQueryListEvent) => {
    applyTheme(resolveTheme(readThemePreference(), event.matches));
  };
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}
