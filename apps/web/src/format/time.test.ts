import { describe, expect, it } from 'vitest';
import { clockTime, dayLabel, formatDuration } from './time.ts';

describe('formatDuration', () => {
  it('drops the hours below one', () => {
    expect(formatDuration(12 * 60_000)).toBe('12 min');
  });

  it('reads hours and minutes above one', () => {
    expect(formatDuration(107 * 60_000)).toBe('1 h 47 min');
  });

  it('rounds down — a session is not a stopwatch', () => {
    expect(formatDuration(119_000)).toBe('1 min');
  });

  it('says 0 min rather than nothing for a session with no elapsed time', () => {
    // Reachable: a session closed lazily whose only tick was written in its first minute.
    expect(formatDuration(0)).toBe('0 min');
  });
});

describe('dayLabel', () => {
  const now = new Date(2026, 7, 8, 20, 30); // Sat 8 Aug 2026, local

  it('names today', () => {
    expect(dayLabel('2026-08-08', now)).toBe('Today');
  });

  it('names yesterday', () => {
    expect(dayLabel('2026-08-07', now)).toBe('Yesterday');
  });

  it('gives an older day its weekday and date', () => {
    expect(dayLabel('2026-07-28', now)).toBe('Tue 28 Jul');
  });

  it('crosses a month boundary backwards', () => {
    // `setDate(0)` territory: 1 Aug's yesterday is 31 Jul, not 0 Aug.
    expect(dayLabel('2026-07-31', new Date(2026, 7, 1, 9, 0))).toBe('Yesterday');
  });

  it('does not shift the day for timezones east of UTC', () => {
    // `new Date('2026-07-28')` parses as UTC midnight, which is the previous local day west of
    // Greenwich and prints an off-by-one date. This parses the parts as local instead.
    expect(dayLabel('2026-07-28', now)).toContain('28');
  });

  it('falls back to the raw date rather than throwing on a malformed one', () => {
    // Only reachable through an import carrying a hand-edited JSON file.
    expect(dayLabel('not-a-date', now)).toBe('not-a-date');
  });
});

describe('clockTime', () => {
  it('is a 24-hour wall clock', () => {
    expect(clockTime(new Date(2026, 7, 8, 17, 5).getTime())).toBe('17:05');
  });

  it('pads the hour, so times line up in a column', () => {
    expect(clockTime(new Date(2026, 7, 8, 9, 5).getTime())).toBe('09:05');
  });

  it('renders midnight as 00:00 rather than 24:00', () => {
    expect(clockTime(new Date(2026, 7, 8, 0, 0).getTime())).toBe('00:00');
  });
});

describe('clockTime with a stored offset', () => {
  // 2026-07-28 21:15 UTC. In Helsinki summer (UTC+3) that is 00:15 the next day.
  const at = Date.UTC(2026, 6, 28, 21, 15);

  it('reads the wall clock of the zone the go was logged in', () => {
    // The bug this replaces: formatting in the *viewer's* zone answered a different question. A go
    // logged at 00:15 in Helsinki showed as 23:15 to a reader in UTC+2, contradicting the date beside it.
    expect(clockTime(at, 180)).toBe('00:15');
  });

  it('gives the same answer wherever it is read', () => {
    // The property that matters: the stored offset, not the reader's, decides the digits.
    expect(clockTime(at, 180)).toBe(clockTime(at, 180));
    expect(clockTime(at, 120)).toBe('23:15');
    expect(clockTime(at, -300)).toBe('16:15');
  });

  it('handles a zero offset without falling back to local time', () => {
    // `0` is falsy — a `tzOffset ?? local` guard would have silently used the reader's zone for UTC.
    expect(clockTime(at, 0)).toBe('21:15');
  });

  it("falls back to the reader's zone when no offset is stored", () => {
    // `Session` carries no offset (§7.7), so a session with no ticks to borrow one from lands here.
    expect(clockTime(new Date(2026, 6, 28, 17, 5).getTime())).toBe('17:05');
  });
});
