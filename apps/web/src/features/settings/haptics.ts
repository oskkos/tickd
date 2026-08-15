import { readHapticPreference } from './preferences.ts';

/**
 * A short buzz when a go is written.
 *
 * `DESIGN.md` §4 asks for this and nothing implemented it, so the toggle in settings and the vibration
 * itself ship together — a control that governs nothing would be worse than no control at all.
 *
 * **A bonus signal, never the only one.** `navigator.vibrate` is unimplemented in iOS Safari and silent
 * on any device with vibration switched off, so the tick's visible confirmation is unchanged and an
 * absent API is a no-op rather than a branch anybody has to handle. Writing the tick must not depend on
 * it in any way.
 *
 * 15ms is a tap, not a notification: long enough to feel through a chalked hand, short enough that
 * eighteen goes in an evening do not add up to a nuisance.
 */
const BUZZ_MS = 15;

export function buzz(): void {
  // The DOM lib declares `vibrate` as always callable; Safari disagrees, which is the same overstatement
  // `db/persist.ts` widens around.
  const { vibrate } = globalThis.navigator as Omit<Navigator, 'vibrate'> & {
    vibrate?: Navigator['vibrate'];
  };
  if (typeof vibrate !== 'function' || !readHapticPreference()) {
    return;
  }
  // An array rather than a bare number: the DOM lib types the pattern as `Iterable<number>`, and a
  // one-element pattern is the same buzz.
  vibrate.call(globalThis.navigator, [BUZZ_MS]);
}
