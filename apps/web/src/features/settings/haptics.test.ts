import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buzz } from './haptics.ts';
import { writeHapticPreference } from './preferences.ts';

function withVibrate(vibrate: unknown) {
  Object.defineProperty(globalThis.navigator, 'vibrate', {
    value: vibrate,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  globalThis.localStorage.clear();
});

afterEach(() => {
  Reflect.deleteProperty(globalThis.navigator, 'vibrate');
});

describe('buzz', () => {
  it('vibrates once by default', () => {
    const vibrate = vi.fn();
    withVibrate(vibrate);

    buzz();

    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('says nothing when the preference is off', () => {
    const vibrate = vi.fn();
    withVibrate(vibrate);
    writeHapticPreference(false);

    buzz();

    expect(vibrate).not.toHaveBeenCalled();
  });

  it('is a no-op where the API is absent', () => {
    // iOS Safari. A bonus signal cannot be allowed to become a branch anybody has to handle.
    expect(Reflect.get(globalThis.navigator, 'vibrate')).toBeUndefined();
    expect(() => {
      buzz();
    }).not.toThrow();
  });
});
