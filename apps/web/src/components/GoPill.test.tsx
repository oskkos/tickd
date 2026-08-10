import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FontLabel, FrenchLabel } from '@tickd/grade-spec';
import { GoPill } from './GoPill.tsx';
import { newId } from '../db/schema.ts';
import { outcomeOf } from '../db/style.ts';
import type { PriorExperience, Tick, TickDiscipline, TickGrade } from '../db/types.ts';

function tick(
  climb: TickDiscipline & TickGrade,
  is_send = true,
  prior_experience: PriorExperience = 'none',
): Tick {
  return {
    id: newId(),
    session_id: 's',
    is_send,
    prior_experience,
    date_local: '2026-08-08',
    tz_offset: 180,
    created_at: 0,
    updated_at: 0,
    ...climb,
  };
}

const french = (grade_raw: FrenchLabel, is_send = true, prior: PriorExperience = 'none') =>
  tick(
    { discipline: 'sport', protection: 'lead', grade_scale: 'french', grade_raw },
    is_send,
    prior,
  );

const font = (grade_raw: FontLabel, is_send = true, prior: PriorExperience = 'none') =>
  tick(
    { discipline: 'boulder', protection: 'none', grade_scale: 'font', grade_raw },
    is_send,
    prior,
  );

/** Pills render an `<li>`, so they need a list to sit in. */
function renderPill(t: Tick) {
  return render(
    <ul>
      <GoPill tick={t} />
    </ul>,
  );
}

describe('GoPill', () => {
  it('names the grade and how the go ended', () => {
    renderPill(french('6a'));

    // The icon is aria-hidden, so the item carries the whole name. This string is the contract the
    // session summary's tests already depend on.
    expect(screen.getByLabelText('6a, flashed')).toBeInTheDocument();
  });

  it('calls a send with history a send, not a flash', () => {
    renderPill(french('6c', true, 'attempted'));

    expect(screen.getByLabelText('6c, sent')).toBeInTheDocument();
  });

  it('calls a go that was not sent not sent', () => {
    renderPill(french('7a', false, 'attempted'));

    expect(screen.getByLabelText('7a, not sent')).toBeInTheDocument();
  });

  it('marks a flash differently from an ordinary send, and not by colour alone', () => {
    const { container: flashed } = renderPill(french('6a'));
    const { container: sent } = renderPill(french('6a', true, 'sent'));

    // Different path geometry, not merely a different fill class: a bolt versus a thumb. Colour is
    // reinforcement, which is what DESIGN.md §3 requires.
    const pathOf = (c: HTMLElement) => c.querySelector('svg path')?.getAttribute('d');
    expect(pathOf(flashed)).not.toBe(pathOf(sent));
  });

  it('renders the grade verbatim, so Font and French stay apart', () => {
    renderPill(font('6A'));

    // `6A` is a Font grade and `6a` is a much easier French one. A `text-transform` anywhere on this
    // path would redisplay one as the other.
    const text = screen.getByText('6A');
    expect(text).toBeInTheDocument();
    expect(text.className).not.toMatch(/uppercase|lowercase|capitalize/);
  });

  it('labels a Font grade without changing its case', () => {
    renderPill(font('6B+'));

    expect(screen.getByLabelText('6B+, flashed')).toBeInTheDocument();
  });
});

describe('outcomeOf', () => {
  it('is total over all six valid pairings', () => {
    const pairs: readonly [boolean, PriorExperience][] = [
      [true, 'none'],
      [true, 'attempted'],
      [true, 'sent'],
      [false, 'none'],
      [false, 'attempted'],
      [false, 'sent'],
    ];

    // Every pairing is valid since `send_style` was dropped (D20), so there is no input this can
    // reject — which is the property that made the two invalid combinations unrepresentable.
    for (const [is_send, prior_experience] of pairs) {
      expect(['flash', 'sent', 'fell']).toContain(outcomeOf({ is_send, prior_experience }));
    }
  });

  it('treats a send with no history as a flash and nothing else as one', () => {
    expect(outcomeOf({ is_send: true, prior_experience: 'none' })).toBe('flash');
    expect(outcomeOf({ is_send: true, prior_experience: 'attempted' })).toBe('sent');
    expect(outcomeOf({ is_send: true, prior_experience: 'sent' })).toBe('sent');
  });

  it('never calls an unsent go a flash, whatever its history', () => {
    // Flash rate's numerator. A false flash here inflates the metric at the limit grade.
    expect(outcomeOf({ is_send: false, prior_experience: 'none' })).toBe('fell');
    expect(outcomeOf({ is_send: false, prior_experience: 'attempted' })).toBe('fell');
  });
});
