import { useState } from 'react';
import { readHapticPreference, writeHapticPreference } from './preferences.ts';

/**
 * Whether writing a go buzzes.
 *
 * A plain `<button>` with `aria-pressed` rather than Base UI's `Switch`, matching `ThemeControl` and
 * `ProtectionGroup`: this screen's controls should be one vocabulary, and a two-state button carries
 * its own state semantics without a library.
 *
 * The preference is read once as initial state. Nothing else in the app writes it, so there is nothing
 * to subscribe to — the logging screen reads it at the moment it writes a tick, which is the only place
 * the value is consumed.
 */
export function HapticControl() {
  const [enabled, setEnabled] = useState(readHapticPreference);

  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={() => {
        writeHapticPreference(!enabled);
        setEnabled(!enabled);
      }}
      className="min-h-touch rounded-box w-full bg-base-200 text-sm aria-pressed:bg-primary aria-pressed:text-primary-content"
    >
      {enabled ? 'On' : 'Off'}
    </button>
  );
}
