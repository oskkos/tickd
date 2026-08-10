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
