import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecentTicks } from './RecentTicks.tsx';
import type { Tick } from '../../db/types.ts';

function tick(overrides: Partial<Tick> = {}): Tick {
  return {
    id: 'a',
    session_id: 's',
    discipline: 'sport',
    protection: 'lead',
    grade_scale: 'french',
    grade_raw: '6c+',
    is_send: true,
    prior_experience: 'none',
    date_local: '2026-08-08',
    tz_offset: 180,
    created_at: 0,
    updated_at: 0,
    ...overrides,
  } as Tick;
}

describe('RecentTicks', () => {
  it('shows what was recorded, not just the grade', () => {
    render(<RecentTicks ticks={[tick()]} onRemove={vi.fn()} onAnnotate={vi.fn()} />);

    // Protection is sticky, so this list is the only place a wrong default becomes visible while
    // still standing at the wall.
    const row = screen.getByRole('listitem');
    expect(row).toHaveTextContent('6c+');
    expect(row).toHaveTextContent(/lead/);
    expect(row).toHaveTextContent(/flash/);
    expect(row).toHaveTextContent(/first go/);
  });

  it('says "fell" rather than inventing a style for an attempt', () => {
    render(
      <RecentTicks
        ticks={[tick({ is_send: false, prior_experience: 'attempted' })]}
        onRemove={vi.fn()}
        onAnnotate={vi.fn()}
      />,
    );

    const row = screen.getByRole('listitem');
    expect(row).toHaveTextContent(/fell/);
    expect(row).toHaveTextContent(/tried before/);
  });

  it('describes a repeat in plain words rather than in enum terms', () => {
    render(
      <RecentTicks
        ticks={[tick({ prior_experience: 'sent' })]}
        onRemove={vi.fn()}
        onAnnotate={vi.fn()}
      />,
    );

    // The data says redpoint; the row says what happened. Both are true.
    expect(screen.getByRole('listitem')).toHaveTextContent(/done before/);
  });

  it('renders grade labels verbatim', () => {
    render(
      <RecentTicks
        ticks={[tick({ grade_scale: 'font', grade_raw: '6A' })]}
        onRemove={vi.fn()}
        onAnnotate={vi.fn()}
      />,
    );

    expect(screen.getByRole('listitem')).toHaveTextContent('6A');
  });

  it('keeps every tick reversible, not just the last', async () => {
    const onRemove = vi.fn();
    render(
      <RecentTicks
        ticks={[tick({ id: 'new', grade_raw: '7a' }), tick({ id: 'old', grade_raw: '6a' })]}
        onRemove={onRemove}
        onAnnotate={vi.fn()}
      />,
    );

    // The mistake is usually noticed after the next climb, which is why this is a list rather than a
    // toast on the most recent row.
    await userEvent.click(screen.getByRole('button', { name: 'Undo 6a' }));

    expect(onRemove).toHaveBeenCalledWith('old');
  });

  it('reopens the detail sheet from a row', async () => {
    const onAnnotate = vi.fn();
    const row = tick({ id: 'old', grade_raw: '6a' });
    render(<RecentTicks ticks={[row]} onRemove={vi.fn()} onAnnotate={onAnnotate} />);

    await userEvent.click(screen.getByRole('button', { name: 'Detail for 6a' }));

    // This is what lets the detail sheet close itself: nothing is lost, because it comes back.
    expect(onAnnotate).toHaveBeenCalledWith(row);
  });

  it('explains itself when the session is empty', () => {
    render(<RecentTicks ticks={[]} onRemove={vi.fn()} onAnnotate={vi.fn()} />);

    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByText(/nothing logged yet/i)).toBeInTheDocument();
  });
});
