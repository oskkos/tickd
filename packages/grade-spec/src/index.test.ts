import { describe, expect, it } from 'vitest';

import {
  clampRange,
  compare,
  equals,
  isLabel,
  labelOf,
  labels,
  maxIndex,
  ordinalOf,
  parseOrdinal,
  SCALE_IDS,
  SPEC_VERSION,
} from './index.ts';

describe('scale definitions', () => {
  it('exposes the spec version', () => {
    expect(SPEC_VERSION).toBe(1);
  });

  it('defines exactly the two Phase 0 scales', () => {
    expect([...SCALE_IDS].sort()).toEqual(['font', 'french']);
  });

  it('has 27 French values, from 4 to 9c', () => {
    const french = labels('french');
    expect(french).toHaveLength(27);
    expect(french.slice(0, 5)).toEqual(['4', '4+', '5', '5+', '6a']);
    expect(french.slice(-2)).toEqual(['9b+', '9c']);
  });

  it('has 23 Font values, from 4 to 9A', () => {
    const font = labels('font');
    expect(font).toHaveLength(23);
    expect(font.slice(0, 5)).toEqual(['4', '4+', '5', '5+', '6A']);
    expect(font.slice(-2)).toEqual(['8C+', '9A']);
  });

  // Asserting `compare(ordinalOf(all[i-1]), ordinalOf(all[i])) < 0` would pass for ANY list in ANY
  // order — the ordinals are derived from the same array being iterated, so it is true by
  // construction. It has to constrain the label *content* instead: difficulty ascends if the leading
  // number never decreases, the letter never goes backwards within a number, and `+` follows its
  // bare grade.
  it.each(SCALE_IDS)('ascends in difficulty through %s', (scale) => {
    const parsed = labels(scale).map((label) => {
      const match = /^(\d)([a-cA-C]?)(\+?)$/.exec(label);
      expect(match, `"${label}" does not match the grade grammar`).not.toBeNull();
      const [, digit, letter, plus] = match!;
      return { label, digit: Number(digit), letter: letter!.toLowerCase(), plus: plus === '+' };
    });

    for (let i = 1; i < parsed.length; i += 1) {
      const previous = parsed[i - 1]!;
      const current = parsed[i]!;
      const context = `${previous.label} -> ${current.label}`;

      expect(current.digit, context).toBeGreaterThanOrEqual(previous.digit);
      if (current.digit === previous.digit) {
        // Same number: either the same letter gaining a `+`, or the next letter starting fresh.
        if (current.letter === previous.letter) {
          expect({ context, plus: current.plus }).toEqual({ context, plus: true });
          expect({ context, plus: previous.plus }).toEqual({ context, plus: false });
        } else {
          expect(current.letter.localeCompare(previous.letter), context).toBe(1);
          expect({ context, plus: current.plus }).toEqual({ context, plus: false });
        }
      }
    }
  });

  it('uses lowercase letters for French and uppercase for Font', () => {
    // The case difference is data, not presentation (CONCEPT.md §7.3).
    expect(labels('french').filter((l) => /[A-Z]/.test(l))).toEqual([]);
    expect(labels('font').filter((l) => /[a-z]/.test(l))).toEqual([]);
  });

  it.each(SCALE_IDS)('has no duplicate labels in %s', (scale) => {
    const all = labels(scale);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('structural cross-check between the scales', () => {
  // The two lists are the same for their first 22 entries apart from letter case. Comparing them to
  // each other catches a typo in either, and demonstrates the case-only difference the namespace
  // separation depends on.
  const SHARED_PREFIX = 22;

  it('agrees case-insensitively across the shared prefix', () => {
    const french = labels('french');
    const font = labels('font');
    for (let i = 0; i < SHARED_PREFIX; i += 1) {
      expect(font[i]!.toLowerCase()).toBe(french[i]!.toLowerCase());
    }
  });

  it('differs by case within the shared prefix wherever a letter appears', () => {
    const french = labels('french');
    const font = labels('font');
    const lettered = french
      .slice(0, SHARED_PREFIX)
      .map((label, i) => [label, font[i]!] as const)
      .filter(([label]) => /[a-z]/.test(label));

    expect(lettered.length).toBeGreaterThan(0);
    for (const [frenchLabel, fontLabel] of lettered) {
      expect(fontLabel).not.toBe(frenchLabel);
    }
  });

  it('diverges above the shared prefix — five French 9s to one Font', () => {
    expect(labels('french').slice(SHARED_PREFIX)).toEqual(['9a', '9a+', '9b', '9b+', '9c']);
    expect(labels('font').slice(SHARED_PREFIX)).toEqual(['9A']);
  });
});

describe('round trip', () => {
  it.each(SCALE_IDS)('is lossless for every %s label, including case', (scale) => {
    for (const label of labels(scale)) {
      expect(labelOf(ordinalOf(label, scale))).toBe(label);
    }
  });

  it('throws rather than guessing for an out-of-range index', () => {
    expect(() => labelOf({ scale: 'french', kind: 'exact', index: 99 })).toThrow(RangeError);
  });
});

describe('validation', () => {
  it('accepts a matching pair', () => {
    expect(isLabel('6a', 'french')).toBe(true);
    expect(isLabel('6A', 'font')).toBe(true);
    expect(isLabel('4+', 'french')).toBe(true);
  });

  // The whole point: case is data, not presentation. A normalising validator would silently move a
  // grade onto the other scale instead of rejecting it — a harder failure to notice than an error.
  it('rejects a case-mismatched pair rather than correcting it', () => {
    expect(isLabel('6A', 'french')).toBe(false);
    expect(isLabel('6a', 'font')).toBe(false);
    expect(isLabel('9A', 'french')).toBe(false);
  });

  it.each([
    ['6d', 'french'],
    ['9c+', 'french'],
    ['5A', 'font'],
    ['V4', 'font'],
    ['', 'french'],
    [' 6a', 'french'],
    ['6a ', 'french'],
    ['6A/6A+', 'font'],
  ] as const)('rejects %s in %s', (raw, scale) => {
    expect(isLabel(raw, scale)).toBe(false);
  });

  it.each([null, undefined, 6, {}, ['6a']])('rejects the non-string %s', (raw) => {
    expect(isLabel(raw, 'french')).toBe(false);
  });

  it('parses untrusted input to an ordinal or undefined', () => {
    expect(parseOrdinal('7b+', 'french')).toEqual({
      scale: 'french',
      kind: 'exact',
      index: 13,
    });
    expect(parseOrdinal('7B+', 'french')).toBeUndefined();
    expect(parseOrdinal('nonsense', 'font')).toBeUndefined();
  });

  it('throws when a known-label function is handed an unknown label', () => {
    // Reachable only by defeating the types, which the importer must not do.
    expect(() => ordinalOf('6d' as never, 'french')).toThrow(RangeError);
  });
});

describe('comparison', () => {
  it('orders within a scale', () => {
    const easy = ordinalOf('6a', 'french');
    const hard = ordinalOf('8a', 'french');
    expect(compare(easy, hard)).toBeLessThan(0);
    expect(compare(hard, easy)).toBeGreaterThan(0);
    expect(compare(easy, easy)).toBe(0);
    expect(equals(easy, ordinalOf('6a', 'french'))).toBe(true);
    expect(equals(easy, hard)).toBe(false);
  });

  it('gives Font 6A and French 6a the same index without treating them as equal', () => {
    const frenchGrade = ordinalOf('6a', 'french');
    const fontGrade = ordinalOf('6A', 'font');
    expect(fontGrade.index).toBe(frenchGrade.index);
    // Nothing in the API accepts both, so there is no equality to assert. The scales differ.
    // Named by scale, not discipline: a French grade may be a boulder too (CONCEPT.md D17).
    expect(fontGrade.scale).not.toBe(frenchGrade.scale);
  });

  it('constructs only exact ordinals in Phase 0', () => {
    for (const scale of SCALE_IDS) {
      for (const label of labels(scale)) {
        expect(ordinalOf(label, scale).kind).toBe('exact');
      }
    }
  });
});

describe('clampRange', () => {
  it('clamps below the easiest grade', () => {
    expect(clampRange(-5, 2, 'french')).toEqual(['4', '4+', '5']);
  });

  it('clamps above the hardest grade', () => {
    const top = maxIndex('font');
    expect(clampRange(top - 1, top + 10, 'font')).toEqual(['8C+', '9A']);
  });

  it('returns the whole scale when the range covers it', () => {
    expect(clampRange(-99, 99, 'font')).toEqual(labels('font'));
  });

  it('accepts reversed bounds', () => {
    expect(clampRange(6, 4, 'french')).toEqual(['6a', '6a+', '6b']);
  });

  it('returns a single grade when the bounds coincide', () => {
    expect(clampRange(4, 4, 'french')).toEqual(['6a']);
  });

  it('produces a working range around a band of recent ticks', () => {
    // What the grid does: [min - 2 ... max + 2] of the last 90 days (DESIGN.md §5).
    const recent = [ordinalOf('6b', 'french'), ordinalOf('7a', 'french')];
    const lo = Math.min(...recent.map((o) => o.index));
    const hi = Math.max(...recent.map((o) => o.index));
    // 6b is index 6 and 7a is index 10, so the band is indices 4–12.
    expect(clampRange(lo - 2, hi + 2, 'french')).toEqual([
      '6a',
      '6a+',
      '6b',
      '6b+',
      '6c',
      '6c+',
      '7a',
      '7a+',
      '7b',
    ]);
  });
});

describe('public surface', () => {
  it('offers no cross-scale conversion', async () => {
    const module: Record<string, unknown> = await import('./index.ts');
    const suspicious = Object.keys(module).filter((name) =>
      /convert|toFont|toFrench|toV|yds/i.test(name),
    );
    expect(suspicious).toEqual([]);
  });
});
