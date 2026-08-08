import { describe, expect, it } from 'vitest';
import { isFirstEncounter, isFlash, isRepeat, sendStyleOf } from './style.ts';
import type { TickOutcome } from './types.ts';

const outcome = (prior: TickOutcome['prior_experience'], is_send: boolean): TickOutcome => ({
  prior_experience: prior,
  is_send,
});

describe('sendStyleOf', () => {
  it('derives a flash from a send with no prior experience', () => {
    // A tick is one go, so this go IS the first acquaintance. There is no other possibility.
    expect(sendStyleOf(outcome('none', true))).toBe('flash');
  });

  it('derives a redpoint from any send with prior experience', () => {
    expect(sendStyleOf(outcome('attempted', true))).toBe('redpoint');
    expect(sendStyleOf(outcome('sent', true))).toBe('redpoint');
  });

  it('derives no style at all when nothing was sent', () => {
    expect(sendStyleOf(outcome('none', false))).toBeUndefined();
    expect(sendStyleOf(outcome('attempted', false))).toBeUndefined();
    expect(sendStyleOf(outcome('sent', false))).toBeUndefined();
  });

  it('is total over all six valid outcomes', () => {
    // The replacement for "invalid combinations are rejected": there are none, so the derivation
    // must accept every pairing rather than reject some.
    const priors = ['none', 'attempted', 'sent'] as const;
    const all = priors.flatMap((p) => [outcome(p, true), outcome(p, false)]);

    expect(all).toHaveLength(6);
    for (const o of all) {
      expect(() => sendStyleOf(o)).not.toThrow();
    }
  });
});

describe('flash rate can be computed from the two stored fields', () => {
  // Four goes on one climb: fell three times, sent on the fourth. One first encounter, no flash.
  const oneProject = [
    outcome('none', false),
    outcome('attempted', false),
    outcome('attempted', false),
    outcome('attempted', true),
  ];

  it('counts one first encounter for a climb worked over four goes', () => {
    expect(oneProject.filter(isFirstEncounter)).toHaveLength(1);
  });

  it('counts no flash for a climb that was not sent first go', () => {
    expect(oneProject.filter(isFlash)).toHaveLength(0);
  });

  it('keeps an unsent first encounter in the denominator', () => {
    // The row D14 exists to protect: walked away from, never sent, still a first encounter. Dropping
    // it would bias flash rate upward at exactly the limit grade the metric exists to find.
    const walkedAway = outcome('none', false);

    expect(isFirstEncounter(walkedAway)).toBe(true);
    expect(isFlash(walkedAway)).toBe(false);
  });

  it('excludes repeats from both numerator and denominator', () => {
    const repeat = outcome('sent', true);

    expect(isFirstEncounter(repeat)).toBe(false);
    expect(isFlash(repeat)).toBe(false);
    expect(isRepeat(repeat)).toBe(true);
  });

  it('gives a flash rate of one half for two first encounters, one flashed', () => {
    const session = [outcome('none', true), outcome('none', false)];
    const denominator = session.filter(isFirstEncounter).length;
    const numerator = session.filter(isFlash).length;

    expect(numerator / denominator).toBe(0.5);
  });
});
