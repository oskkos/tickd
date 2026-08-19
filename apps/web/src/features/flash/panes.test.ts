import { describe, expect, it } from 'vitest';
import { PROTECTION_ORDER, type FlashRateGroup } from '../../db/flashRate.ts';
import type { Protection } from '../../db/types.ts';
import { defaultProtection, protectionsPresent } from './panes.ts';

/** A group with one row, since these two functions read only its `protection`. */
function group(protection: Protection, scale: 'font' | 'french' = 'french'): FlashRateGroup {
  return {
    discipline: protection === 'none' ? 'boulder' : 'sport',
    scale,
    protection,
    rows: [{ label: '6a', encounters: 4, flashes: 2 }],
  };
}

describe('protectionsPresent', () => {
  it('carries only the protections that produced a group', () => {
    // `flashRates` produces a group only where a first encounter exists, so *has a group* already means
    // *has a first encounter* and no second condition is written here.
    expect(protectionsPresent([group('lead'), group('none', 'font')])).toEqual(['lead', 'none']);
  });

  it('omits a protection with no group rather than carrying it disabled', () => {
    expect(protectionsPresent([group('lead')])).not.toContain('toprope');
  });

  it('carries autobelay as its own entry', () => {
    // D6's *segment, never exclude*: auto-belay laps get their own numbers rather than being folded into
    // toprope or hidden for being uninteresting. A flat line near 100% is information.
    expect(protectionsPresent([group('autobelay')])).toEqual(['autobelay']);
  });

  it('orders entries by PROTECTION_ORDER whatever order the groups arrive in', () => {
    const reversed = [group('none', 'font'), group('autobelay'), group('toprope'), group('lead')];
    expect(protectionsPresent(reversed)).toEqual(PROTECTION_ORDER);
  });

  it('deduplicates a protection that spans two scales', () => {
    // Boulder alone spans Font and French under today's seed (D17): two charts, one selector entry.
    expect(protectionsPresent([group('none', 'font'), group('none', 'french')])).toEqual(['none']);
  });

  it("is empty for no groups, which is the screen's empty state", () => {
    expect(protectionsPresent([])).toEqual([]);
  });
});

describe('defaultProtection', () => {
  it('prefers lead when lead has data', () => {
    expect(defaultProtection(['lead', 'toprope', 'none'])).toBe('lead');
  });

  it('prefers lead even when it is not first in the list it was handed', () => {
    expect(defaultProtection(['toprope', 'lead'])).toBe('lead');
  });

  it('falls to the first protection with data when lead has none', () => {
    // §4.2 names lead as the default view; applied unconditionally it opens a boulderer onto an empty
    // pane with their data one tap away, which reads as "you have no numbers" and is false.
    expect(defaultProtection(['toprope', 'none'])).toBe('toprope');
    expect(defaultProtection(['none'])).toBe('none');
  });

  it('has no default when there are no panes, rather than naming one that does not exist', () => {
    expect(defaultProtection([])).toBeUndefined();
  });
});
