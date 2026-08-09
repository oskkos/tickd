import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnnotationSheet, SHEET_IDLE_MS } from './AnnotationSheet.tsx';
import type { Tick } from '../../db/types.ts';

const tick = {
  id: 'a',
  session_id: 's',
  discipline: 'sport',
  protection: 'lead',
  grade_scale: 'french',
  grade_raw: '6c+',
  is_send: true,
  prior_experience: 'none',
  date_local: '2026-08-09',
  tz_offset: 180,
  created_at: 0,
  updated_at: 0,
} as Tick;

afterEach(() => {
  vi.useRealTimers();
});

/** Touch the sheet the way a thumb does, which is what retires the countdown. */
function touchInside() {
  act(() => {
    screen
      .getByRole('button', { name: 'overhang' })
      .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  });
}

describe('AnnotationSheet', () => {
  it('names the tick it is for', () => {
    render(<AnnotationSheet tick={tick} annotation={{}} onChange={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Detail for 6c+' })).toBeInTheDocument();
  });

  it('closes itself after a spell of inactivity', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <AnnotationSheet tick={tick} annotation={{}} onChange={vi.fn()} onDismiss={onDismiss} />,
    );

    act(() => {
      vi.advanceTimersByTime(SHEET_IDLE_MS);
    });

    // Safe to close only because the tick is already written and the row reopens it.
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('stops the countdown for good once it is touched', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <AnnotationSheet tick={tick} annotation={{}} onChange={vi.fn()} onDismiss={onDismiss} />,
    );

    touchInside();
    // Ten times the window, deliberately. An earlier version of this test advanced less than one
    // full window after the touch, so it passed whether the timer stopped or merely restarted —
    // it could not tell the two apart and proved nothing.
    act(() => {
      vi.advanceTimersByTime(SHEET_IDLE_MS * 10);
    });

    // Retired, not restarted. A clock that keeps chasing someone mid-form is worse than none.
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('counts down again for the next tick', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    // Keyed on the tick id, exactly as the screen renders it — that key is what makes a new tick a
    // new sheet with a fresh countdown.
    const { rerender } = render(
      <AnnotationSheet
        key={tick.id}
        tick={tick}
        annotation={{}}
        onChange={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    touchInside();
    rerender(
      <AnnotationSheet
        key="b"
        tick={{ ...tick, id: 'b', grade_raw: '7a' } as Tick}
        annotation={{}}
        onChange={vi.fn()}
        onDismiss={onDismiss}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(SHEET_IDLE_MS);
    });

    // Touching retires the countdown for *that* tick, not for the rest of the session.
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows a countdown matching the timeout it depicts', () => {
    render(<AnnotationSheet tick={tick} annotation={{}} onChange={vi.fn()} onDismiss={vi.fn()} />);

    const bar = screen.getByTestId('sheet-countdown');
    // One source of truth: the bar reads its duration from the same constant as the timer, so it
    // cannot drift from the behaviour it depicts.
    expect(bar.style.animationDuration).toBe(`${String(SHEET_IDLE_MS)}ms`);
    // It conveys nothing a screen reader can act on; "Done" covers that ground without sight.
    expect(bar).toHaveAttribute('aria-hidden', 'true');
  });

  it('removes the countdown once touched, rather than freezing it', async () => {
    render(<AnnotationSheet tick={tick} annotation={{}} onChange={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByTestId('sheet-countdown')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'overhang' }));

    // A stalled bar would suggest a timer merely paused, which is a different promise from gone.
    expect(screen.queryByTestId('sheet-countdown')).toBeNull();
  });

  it('can be dismissed deliberately', async () => {
    const onDismiss = vi.fn();
    render(
      <AnnotationSheet tick={tick} annotation={{}} onChange={vi.fn()} onDismiss={onDismiss} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /done/i }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('reports changes as they happen rather than on close', async () => {
    const onChange = vi.fn();
    render(<AnnotationSheet tick={tick} annotation={{}} onChange={onChange} onDismiss={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'crimp' }));

    // Saving on change is what makes the auto-close harmless — there is no unsaved state to lose.
    expect(onChange).toHaveBeenCalledWith({ holds: ['crimp'] });
  });

  it('shows the grade verbatim', () => {
    render(
      <AnnotationSheet
        tick={{ ...tick, grade_scale: 'font', grade_raw: '6A' }}
        annotation={{}}
        onChange={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByRole('region', { name: 'Detail for 6A' })).toBeInTheDocument();
  });
});
