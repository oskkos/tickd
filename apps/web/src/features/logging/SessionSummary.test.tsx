import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionSummary } from './SessionSummary.tsx';
import { formatDuration, goesInOrder } from './summary.ts';
import type { Session, Tick, Venue } from '../../db/types.ts';

const session: Session = {
  id: 's',
  venue_id: 'v',
  date_local: '2026-08-09',
  started_at: 0,
};

const venue = { id: 'v', name: 'Kiipeilyareena Salmisaari' } as Venue;

function tick(grade: string, isSend = true, prior: Tick['prior_experience'] = 'none'): Tick {
  return {
    id: `${grade}-${String(Math.random())}`,
    session_id: 's',
    discipline: 'sport',
    protection: 'lead',
    grade_scale: 'french',
    grade_raw: grade,
    is_send: isSend,
    prior_experience: prior,
    date_local: '2026-08-09',
    tz_offset: 180,
    created_at: 0,
    updated_at: 0,
  } as Tick;
}

const HOUR = 60 * 60 * 1000;

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
});

describe('goesInOrder', () => {
  it('returns the session oldest first', () => {
    const later = { ...tick('6b'), created_at: 200 } as Tick;
    const earlier = { ...tick('6a'), created_at: 100 } as Tick;

    // A summary is the story of the session; the recent list is already newest-first for undo.
    expect(goesInOrder([later, earlier]).map((t) => t.grade_raw)).toEqual(['6a', '6b']);
  });

  it('keeps every go rather than tallying by grade', () => {
    const goes = [tick('6a'), tick('6a', false), tick('6a')];

    // Two goes on one grade may be a flash and a fall. Rolling them into "6a x3" throws away the
    // difference the whole model exists to record.
    expect(goesInOrder(goes)).toHaveLength(3);
  });

  it('does not mutate what it is given', () => {
    const goes = [
      { ...tick('6b'), created_at: 200 } as Tick,
      { ...tick('6a'), created_at: 100 } as Tick,
    ];
    const original = [...goes];

    goesInOrder(goes);

    expect(goes).toEqual(original);
  });
});

describe('SessionSummary', () => {
  const ticks = [tick('6a'), tick('6a'), tick('6b', false), tick('6c', true, 'attempted')];

  function renderSummary(over = ticks, onConfirm = vi.fn(), onCancel = vi.fn()) {
    render(
      <SessionSummary
        session={session}
        venue={venue}
        ticks={over}
        now={new Date(HOUR + 47 * 60_000)}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
  }

  it('reports the venue, duration and what was logged', () => {
    renderSummary();

    expect(screen.getByRole('heading', { name: /salmisaari/i })).toBeInTheDocument();
    expect(screen.getByText(/1 h 47 min/)).toBeInTheDocument();
    expect(screen.getByText(/4 ticks/)).toBeInTheDocument();
    expect(screen.getByText(/3 sent/)).toBeInTheDocument();
    // One flash: the 6c was sent but had been tried before, so it is a redpoint.
    expect(screen.getByText(/2 flashed/)).toBeInTheDocument();
  });

  it('shows one entry per go, not one per grade', () => {
    renderSummary();

    const list = screen.getByRole('list', { name: 'Grades climbed' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
  });

  it('distinguishes a flash from an ordinary send', () => {
    renderSummary();

    // Labelled rather than left to the icon, which is aria-hidden. A flash gets its own mark because
    // it is flash rate's numerator — flattening it into "sent" would have the summary disagree with
    // the one metric Phase 0 ships.
    expect(screen.getAllByLabelText('6a, flashed')).toHaveLength(2);
    expect(screen.getByLabelText('6c, sent')).toBeInTheDocument();
    expect(screen.getByLabelText('6b, not sent')).toBeInTheDocument();
  });

  it('distinguishes two goes on the same grade that ended differently', () => {
    renderSummary([tick('7a', false), tick('7a', true, 'attempted')]);

    // The fall and the send are both visible. A tally would have shown "7a x2" and lost it. The send
    // reads as "sent" rather than "flashed", because it had been tried before.
    expect(screen.getByLabelText('7a, not sent')).toBeInTheDocument();
    expect(screen.getByLabelText('7a, sent')).toBeInTheDocument();
  });

  it('does not end the session until it is confirmed', async () => {
    const onConfirm = vi.fn();
    renderSummary(ticks, onConfirm);

    // Ending is destructive of the current context and reachable by mis-tap like anything else.
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /end session/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('can be backed out of', async () => {
    const onCancel = vi.fn();
    renderSummary(ticks, vi.fn(), onCancel);

    await userEvent.click(screen.getByRole('button', { name: /keep climbing/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('says plainly that an empty session will not be kept', () => {
    renderSummary([]);

    // Finding nothing in history afterwards would otherwise read as data loss.
    expect(screen.getByText(/won.t be kept/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /discard session/i })).toBeInTheDocument();
  });

  it('offers nothing to type, because a session note has nowhere to go yet', () => {
    renderSummary();

    // conditions and felt were dropped (D21) and session_note is Phase 2. Adding a field here would
    // reverse that decision through the back door.
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('shows no flash rate, which belongs to its own screen', () => {
    renderSummary();

    // Over one session it is a sample of a handful — the least trustworthy version of the metric.
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.queryByText(/flash rate/i)).toBeNull();
  });
});
