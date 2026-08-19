import { describe, expect, it } from 'vitest';
import { PROTECTION_ORDER } from '../../db/flashRate.ts';
import { chartLabel, notationLabel, protectionTab } from './labels.ts';

describe('notationLabel', () => {
  it('names notations as proper nouns rather than enum values', () => {
    expect(notationLabel('font')).toBe('Font');
    expect(notationLabel('french')).toBe('French');
  });
});

describe('chartLabel', () => {
  it('names the protection and the notation', () => {
    expect(chartLabel({ protection: 'lead', scale: 'french' })).toBe('lead · French');
  });

  it('names a boulder chart as boulder, never as none', () => {
    // `protection: 'none'` *means* boulder (§7.4), and for boulder the protection is the discipline, so
    // this heading is complete rather than merely short.
    expect(chartLabel({ protection: 'none', scale: 'font' })).toBe('boulder · Font');
  });

  it('distinguishes the two boulder scales the seed guarantees', () => {
    // Font at the Kiipeilyareena sites, French at Tampere (D17). Without the notation these two charts
    // would be headed identically while their grade columns read `6A` and `6a` — labels differing only in
    // letter case, from separate ordinal namespaces (§7.3).
    expect(chartLabel({ protection: 'none', scale: 'font' })).not.toBe(
      chartLabel({ protection: 'none', scale: 'french' }),
    );
  });
});

describe('protectionTab', () => {
  it('capitalises every protection for the selector', () => {
    expect(PROTECTION_ORDER.map(protectionTab)).toEqual([
      'Lead',
      'Toprope',
      'Autobelay',
      'Boulder',
    ]);
  });

  it('capitalises the word without altering it', () => {
    // Was `protectionTab(p).toLowerCase() === protectionLabel(p)`, which has `protectionLabel` on both
    // sides of the assertion and therefore passes even if it returned `'none'`. The literal words are the
    // claim, so the literal words are what is written down.
    expect(protectionTab('none')).toBe('Boulder');
    expect(protectionTab('autobelay')).toBe('Autobelay');
  });

  it('never shows the stored word for the absence of protection', () => {
    expect(PROTECTION_ORDER.map(protectionTab)).not.toContain('None');
  });
});
