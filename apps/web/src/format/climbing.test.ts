import { describe, expect, it } from 'vitest';
import type { PriorExperience, Protection } from '../db/types.ts';
import type { GoOutcome } from '../db/style.ts';
import { outcomeWord, priorLabel, protectionLabel } from './climbing.ts';

/**
 * The vocabulary asserted directly, and this file is younger than the module by design's misfortune.
 *
 * These three functions were covered only through the five surfaces that render them, which is coverage of
 * a sort — but every one of those surfaces asserts a *row*, so the word can be checked in a screen while
 * nothing pins the word itself. That mattered the moment `protectionLabel` became the single authority on
 * *`none` reads as boulder* for the session card, the recent-ticks list, the go sheet, the session detail
 * and the flash-rate selector: consolidating five copies into one is only a gain while the one is held
 * down, and until now the consolidation could have been undone without a failure anywhere.
 */

const PROTECTIONS: readonly Protection[] = ['lead', 'toprope', 'autobelay', 'none'];

describe('protectionLabel', () => {
  it('renders the absence of protection as boulder', () => {
    // §7.4: `protection: 'none'` *means* boulder. The stored word in front of a climber reads
    // `none · flash · first go`, which offers "no protection" as a fourth way of being roped rather than
    // naming the discipline.
    expect(protectionLabel('none')).toBe('boulder');
  });

  it('never lets the stored word for boulder reach a screen', () => {
    expect(PROTECTIONS.map(protectionLabel)).not.toContain('none');
  });

  it('renders the three roped protections as they are stored', () => {
    // No second spelling: `ProtectionGroup` prints these on the logging screen, so a prettier `Auto-belay`
    // here would be one enum value with two words for it across two controls.
    expect(protectionLabel('lead')).toBe('lead');
    expect(protectionLabel('toprope')).toBe('toprope');
    expect(protectionLabel('autobelay')).toBe('autobelay');
  });

  it('gives every protection a non-empty word', () => {
    for (const protection of PROTECTIONS) {
      expect(protectionLabel(protection)).not.toBe('');
    }
  });
});

describe('priorLabel', () => {
  it('says what happened rather than what the enum is called', () => {
    // `prior_experience` cannot be defaulted (D6, D14, D20), so these three words are what the climber
    // reads back to check the one field the UI forces them to choose.
    const words: Record<PriorExperience, string> = {
      none: 'first go',
      attempted: 'tried before',
      sent: 'done before',
    };
    for (const [prior, word] of Object.entries(words) as [PriorExperience, string][]) {
      expect(priorLabel(prior)).toBe(word);
    }
  });

  it('never says redpoint or flash, which are outcomes and not history', () => {
    const said = (['none', 'attempted', 'sent'] as const).map(priorLabel).join(' ');
    expect(said).not.toMatch(/redpoint|flash/);
  });
});

describe('outcomeWord', () => {
  it('distinguishes a flash from a plain send', () => {
    // A flash is flash rate's numerator and the two are not the same event, so a flash announced as a
    // send would make the metric's own vocabulary disagree with the metric.
    const words: Record<GoOutcome, string> = {
      flash: 'flashed',
      sent: 'sent',
      fell: 'not sent',
    };
    for (const [outcome, word] of Object.entries(words) as [GoOutcome, string][]) {
      expect(outcomeWord(outcome)).toBe(word);
    }
  });

  it('says a go was not sent rather than that it was fallen off', () => {
    // One vocabulary across screens: this row said "fell" and the session detail said "not sent" for the
    // same go once, which is one vocabulary too many.
    expect(outcomeWord('fell')).toBe('not sent');
  });
});
