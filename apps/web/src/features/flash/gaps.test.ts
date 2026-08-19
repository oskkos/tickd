import { describe, expect, it } from 'vitest';
import type { FlashRateRow } from '../../db/flashRate.ts';
import { collapseGaps } from './gaps.ts';

const met = (label: string, flashes: number, encounters: number): FlashRateRow => ({
  label,
  flashes,
  encounters,
});
const unmet = (label: string): FlashRateRow => ({ label, flashes: 0, encounters: 0 });

describe('collapseGaps', () => {
  it('keeps every met grade as its own rate item', () => {
    expect(collapseGaps([met('6a', 8, 9), met('6b', 7, 11)])).toEqual([
      { kind: 'rate', row: met('6a', 8, 9) },
      { kind: 'rate', row: met('6b', 7, 11) },
    ]);
  });

  it('collapses a run of five unmet grades into one item naming all five', () => {
    const items = collapseGaps([
      met('7a', 0, 6),
      unmet('7a+'),
      unmet('7b'),
      unmet('7b+'),
      unmet('7c'),
      unmet('7c+'),
      met('8a', 1, 1),
    ]);

    expect(items).toHaveLength(3);
    expect(items[1]).toEqual({ kind: 'gap', labels: ['7a+', '7b', '7b+', '7c', '7c+'] });
  });

  it('collapses a run of one, because there is no threshold to be under', () => {
    // The design left "elide runs of two or more, or of three or more?" open, and the question
    // dissolves: `0/0` is not a rate, so a single unmet grade could never have been a `RateRow` — the
    // only choice was between two shapes of gap row. A threshold here would buy a second rendering of
    // one fact and put a not-yet-climbed grade one step closer to looking like a measured 0%.
    expect(collapseGaps([met('6a', 3, 4), unmet('6a+'), met('6b', 1, 5)])).toEqual([
      { kind: 'rate', row: met('6a', 3, 4) },
      { kind: 'gap', labels: ['6a+'] },
      { kind: 'rate', row: met('6b', 1, 5) },
    ]);
  });

  it('separates two runs rather than merging them across the grade between', () => {
    const items = collapseGaps([
      met('6a', 1, 3),
      unmet('6a+'),
      met('6b', 1, 3),
      unmet('6b+'),
      unmet('6c'),
      met('6c+', 1, 3),
    ]);

    expect(items.map((i) => i.kind)).toEqual(['rate', 'gap', 'rate', 'gap', 'rate']);
  });

  it('never turns a zero-encounter grade into a rate item', () => {
    // The invariant behind the split: a grade nobody has met has no rate at all, so no consumer may be
    // handed one carrying `encounters: 0` to divide by.
    const items = collapseGaps([met('6a', 0, 6), unmet('6a+'), met('6b', 0, 3)]);

    for (const item of items) {
      if (item.kind === 'rate') {
        expect(item.row.encounters).toBeGreaterThan(0);
      }
    }
  });

  it('emits a trailing run, which nothing else in this file would notice', () => {
    // Dropping the flush after the loop makes a trailing run vanish silently — every other fixture here
    // ends on a met grade, so nothing failed. `flashRates` cannot produce a trailing gap, since the span's
    // ends are `min`/`max` over observed ordinals; but this function explicitly declines to rely on that,
    // and *that* is the claim being tested.
    expect(collapseGaps([met('6a', 1, 3), unmet('6a+'), unmet('6b')])).toEqual([
      { kind: 'rate', row: met('6a', 1, 3) },
      { kind: 'gap', labels: ['6a+', '6b'] },
    ]);
  });

  it('emits a leading run rather than dropping it', () => {
    // The other end of the same claim. Refusing to emit a leading gap would be a statement about the data
    // enforced in the wrong module — this one has no way to know whether its caller was `flashRates`.
    expect(collapseGaps([unmet('4'), unmet('4+'), met('5', 2, 4)])).toEqual([
      { kind: 'gap', labels: ['4', '4+'] },
      { kind: 'rate', row: met('5', 2, 4) },
    ]);
  });

  it('is empty for no rows, rather than one empty gap', () => {
    expect(collapseGaps([])).toEqual([]);
  });
});
