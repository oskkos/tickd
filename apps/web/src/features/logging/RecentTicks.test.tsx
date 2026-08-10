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

/** Five goes, so the three-row cap has something to hide. */
const FIVE_GRADES = ['7a', '7b', '7c', '6a', '6b'] as const;

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
    // toast on the most recent row. The list now collapses to the latest go, so reaching an older one
    // costs a tap — but it must still cost only a tap, and never be impossible.
    await userEvent.click(screen.getByRole('button', { name: /2 goes · show all/i }));
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

  it('shows only the go just logged, so it is not a second scroller', () => {
    const five = FIVE_GRADES.map((g, i) => tick({ id: `t${String(i)}`, grade_raw: g }));
    render(<RecentTicks ticks={five} onRemove={vi.fn()} onAnnotate={vi.fn()} />);

    // The shell is bounded to the viewport, so a list long enough to scroll would sit under the grade
    // grid's scroller: the same swipe would do different things 40px apart, on the screen most likely
    // to be used one-handed. The cap is what keeps the grid the only scroller in practice.
    //
    // The cap is asserted, not the absence of a scroll: `overflow-y-auto` stays on as a last resort,
    // because on a very short viewport the alternative was rows off the bottom of the screen with
    // nothing able to reach them.
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('listitem')).toHaveTextContent('7a');
  });

  it('keeps the earlier goes reachable, because undo is the point', async () => {
    const onRemove = vi.fn();
    const five = FIVE_GRADES.map((g, i) => tick({ id: `t${String(i)}`, grade_raw: g }));
    render(<RecentTicks ticks={five} onRemove={onRemove} onAnnotate={vi.fn()} />);

    // A cap alone would have made every earlier go impossible to undo — there is no other route to
    // them, and DESIGN.md makes undo persistent precisely because the mistake surfaces late. So the
    // count is a control.
    expect(screen.queryByRole('button', { name: 'Undo 6b' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /5 goes · show all/i }));

    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    await userEvent.click(screen.getByRole('button', { name: 'Undo 6b' }));
    expect(onRemove).toHaveBeenCalledWith('t4');
  });

  it('offers no expansion when the only go is already shown', () => {
    render(<RecentTicks ticks={[tick({ id: 'a' })]} onRemove={vi.fn()} onAnnotate={vi.fn()} />);

    // A "show all 1" that reveals nothing is a control that lies about having something behind it.
    expect(screen.queryByRole('button', { name: /show all/i })).toBeNull();
  });

  it('explains itself when the session is empty', () => {
    render(<RecentTicks ticks={[]} onRemove={vi.fn()} onAnnotate={vi.fn()} />);

    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByText(/nothing logged yet/i)).toBeInTheDocument();
  });
});

describe('the space it keeps', () => {
  it('holds a floor of one whole row', () => {
    render(<RecentTicks ticks={[tick()]} onRemove={vi.fn()} onAnnotate={vi.fn()} />);

    // Measured in Chromium at 412×600 with eight goes logged and the tab bar present: the grade grid
    // held at its own floor, so this list was what yielded — down to 24px, showing a sliver of the row
    // it exists to show. jsdom has no layout engine, so this guards the cause rather than the symptom.
    expect(screen.getByRole('list', { name: 'Recent ticks' })).toHaveClass('min-h-12');
  });

  it('does not pad a row that is already a touch target', () => {
    render(<RecentTicks ticks={[tick()]} onRemove={vi.fn()} onAnnotate={vi.fn()} />);

    // The row's height comes from the inner button's `min-h-touch`. A `py-2` on the item turned a 48px
    // target into a 64px row — sixteen pixels of nothing, and what stopped one row fitting.
    const row = screen.getByRole('list', { name: 'Recent ticks' }).firstElementChild;
    expect(row).not.toHaveClass('py-2');
    expect(screen.getByRole('button', { name: 'Detail for 6c+' })).toHaveClass('min-h-touch');
  });
});
