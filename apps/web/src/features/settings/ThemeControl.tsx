import { useEffect, useState } from 'react';
import {
  applyTheme,
  readThemePreference,
  resolveTheme,
  systemPrefersDark,
  watchSystemTheme,
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
 * **Neither the first paint nor the system watch is this component's job**, and both used to look as if
 * they were. `index.html` applies the stored theme before the bundle loads, because an effect would flash
 * the wrong one; `main.tsx` re-applies it and then subscribes to the system for the lifetime of the app.
 * This control is mounted only while `/settings` is on screen, so a subscription owned by it followed the
 * system on the one surface nobody is on. What is left here is applying a *choice* the moment it is made.
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
    // The same watcher `main.tsx` starts at boot, which is where following the system actually lives —
    // this control is unmounted the moment the user leaves settings. Subscribing here too costs one
    // idempotent listener and keeps the component correct when it is rendered on its own.
    return watchSystemTheme();
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
