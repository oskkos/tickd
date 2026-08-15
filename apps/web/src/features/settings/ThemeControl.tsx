import { useEffect, useState } from 'react';
import {
  applyTheme,
  darkMediaQuery,
  readThemePreference,
  resolveTheme,
  systemPrefersDark,
  writeThemePreference,
  type ThemePreference,
} from './preferences.ts';

/**
 * The theme, chosen here and nowhere else.
 *
 * Replaces the shell header's `ThemeSwitch`, which was marked temporary from the day it was written and
 * deferred exactly this decision — where the control lives, and whether the choice persists — to the
 * settings screen. Both answers are here: it lives on this surface, and it persists in `localStorage`.
 *
 * **Three values, not a toggle.** *Follow system* is the default and the reason is not neutrality: a phone
 * in a dim gym is already in dark mode, so following it arrives at `DESIGN.md` §3's requirement without
 * overriding a choice the user made once for every app they own.
 *
 * Three buttons rather than a `Select`, which is what `DESIGN.md` §6's usage table suggests: a select is a
 * two-tap control with a popup, and this is the same shape of choice `ProtectionGroup` already renders as
 * a segmented row at full touch size. Consistency with the app's other three-way choice beats consistency
 * with a table written before either existed.
 *
 * The first paint is not this component's job — `index.html` has already applied the stored theme, because
 * an effect would flash the wrong one. This keeps it in step from mount onwards.
 */
const OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

export function ThemeControl() {
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference);

  useEffect(() => {
    applyTheme(resolveTheme(preference, systemPrefersDark()));

    if (preference !== 'system') {
      return;
    }

    // Only *follow system* subscribes. An explicit choice must not move when the phone's own schedule
    // flips at sunset — that is the difference between choosing a theme and choosing to follow one.
    const query = darkMediaQuery();
    if (!query) {
      return;
    }
    const onChange = (event: MediaQueryListEvent) => {
      applyTheme(resolveTheme('system', event.matches));
    };
    query.addEventListener('change', onChange);
    return () => {
      query.removeEventListener('change', onChange);
    };
  }, [preference]);

  return (
    <div role="group" aria-label="Theme" className="flex gap-2">
      {OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={value === preference}
          onClick={() => {
            writeThemePreference(value);
            setPreference(value);
          }}
          className="min-h-touch rounded-box flex-1 bg-base-200 text-sm aria-pressed:bg-primary aria-pressed:text-primary-content"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
