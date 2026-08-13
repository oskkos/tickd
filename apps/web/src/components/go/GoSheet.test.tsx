import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GoSheet, SHEET_IDLE_MS } from './GoSheet.tsx';
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

/**
 * The three correction handlers, defaulted for the tests that are not about corrections.
 *
 * Spread rather than repeated at fourteen call sites: a test about the countdown says nothing about
 * re-grading, and listing them there would bury what each test is actually asserting.
 */
function corrections() {
  return {
    onCorrectGrade: vi.fn(),
    onCorrectProtection: vi.fn(),
    onCorrectOutcome: vi.fn(),
  };
}

describe('GoSheet', () => {
  it('names the tick it is for', () => {
    render(
      <GoSheet
        tick={tick}
        reason="logged"
        annotation={{}}
        {...corrections()}
        onChange={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByRole('region', { name: 'Detail for 6c+' })).toBeInTheDocument();
  });

  it('closes itself after a spell of inactivity', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <GoSheet
        tick={tick}
        reason="logged"
        annotation={{}}
        {...corrections()}
        onChange={vi.fn()}
        onDismiss={onDismiss}
      />,
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
      <GoSheet
        tick={tick}
        reason="logged"
        annotation={{}}
        {...corrections()}
        onChange={vi.fn()}
        onDismiss={onDismiss}
      />,
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
      <GoSheet
        key={tick.id}
        tick={tick}
        reason="logged"
        annotation={{}}
        {...corrections()}
        onChange={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    touchInside();
    rerender(
      <GoSheet
        key="b"
        tick={{ ...tick, id: 'b', grade_raw: '7a' } as Tick}
        reason="logged"
        annotation={{}}
        {...corrections()}
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
    render(
      <GoSheet
        tick={tick}
        reason="logged"
        annotation={{}}
        {...corrections()}
        onChange={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    const bar = screen.getByTestId('sheet-countdown');
    // One source of truth: the bar reads its duration from the same constant as the timer, so it
    // cannot drift from the behaviour it depicts.
    expect(bar.style.animationDuration).toBe(`${String(SHEET_IDLE_MS)}ms`);
    // It conveys nothing a screen reader can act on; "Done" covers that ground without sight.
    expect(bar).toHaveAttribute('aria-hidden', 'true');
  });

  it('removes the countdown once touched, rather than freezing it', async () => {
    render(
      <GoSheet
        tick={tick}
        reason="logged"
        annotation={{}}
        {...corrections()}
        onChange={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByTestId('sheet-countdown')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'overhang' }));

    // A stalled bar would suggest a timer merely paused, which is a different promise from gone.
    expect(screen.queryByTestId('sheet-countdown')).toBeNull();
  });

  it('blocks the screen behind it', () => {
    render(
      <GoSheet
        tick={tick}
        reason="logged"
        annotation={{}}
        {...corrections()}
        onChange={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    // Reverses the original "not modal" decision. Unblocked, a tap meant for the sheet that landed
    // just outside it logged a whole new tick and replaced the sheet being filled in — the cheap path
    // cost a wrong row in the database. Being `fixed`, the backdrop also stops the scroll behind it.
    const backdrop = screen.getByRole('button', { name: /close detail/i });
    expect(backdrop).toHaveClass('fixed');
    expect(backdrop).toHaveClass('inset-0');
  });

  it('is dismissed by the tap that would previously have logged something', async () => {
    const onDismiss = vi.fn();
    render(
      <GoSheet
        tick={tick}
        reason="logged"
        annotation={{}}
        {...corrections()}
        onChange={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /close detail/i }));

    // The way out has to be bigger than the way in, and it is the whole screen. A backdrop that only
    // absorbed taps would read as the app having frozen.
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('can be dismissed deliberately', async () => {
    const onDismiss = vi.fn();
    render(
      <GoSheet
        tick={tick}
        reason="logged"
        annotation={{}}
        {...corrections()}
        onChange={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /done/i }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('reports changes as they happen rather than on close', async () => {
    const onChange = vi.fn();
    render(
      <GoSheet
        tick={tick}
        reason="logged"
        annotation={{}}
        {...corrections()}
        onChange={onChange}
        onDismiss={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'crimp' }));

    // Saving on change is what makes the auto-close harmless — there is no unsaved state to lose.
    expect(onChange).toHaveBeenCalledWith({ holds: ['crimp'] });
  });

  it('shows the grade verbatim', () => {
    render(
      <GoSheet
        tick={{ ...tick, grade_scale: 'font', grade_raw: '6A' }}
        reason="logged"
        annotation={{}}
        {...corrections()}
        onChange={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByRole('region', { name: 'Detail for 6A' })).toBeInTheDocument();
  });
});

describe('a sheet the climber asked for', () => {
  function reopened(onDismiss = vi.fn()) {
    render(
      <GoSheet
        tick={tick}
        reason="reopened"
        annotation={{}}
        {...corrections()}
        onChange={vi.fn()}
        onDismiss={onDismiss}
      />,
    );
    return onDismiss;
  }

  it('does not close itself, however long it is left', () => {
    vi.useFakeTimers();
    const onDismiss = reopened();

    act(() => {
      // Ten times the idle interval. The countdown exists to keep an *interruption* of the two-tap
      // path cheap; there is no such path to protect when the sheet is what was tapped, so a clock
      // here would be racing the climber to finish a field that was optional to begin with.
      vi.advanceTimersByTime(SHEET_IDLE_MS * 10);
    });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('shows no countdown, since there is nothing to count down to', () => {
    reopened();

    expect(screen.queryByTestId('sheet-countdown')).toBeNull();
  });

  it('does not claim the tick was just logged', () => {
    reopened();

    // The fault this fixes was live: reopening a go from three weeks ago announced "Logged 6c+".
    expect(screen.getByRole('region', { name: 'Detail for 6c+' })).not.toHaveTextContent(/logged/i);
  });

  it('still names the grade, verbatim', () => {
    reopened();

    expect(screen.getByRole('region', { name: 'Detail for 6c+' })).toHaveTextContent('6c+');
  });

  it('can still be dismissed deliberately', async () => {
    const onDismiss = reopened();

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(onDismiss).toHaveBeenCalled();
  });

  it('still blocks the screen behind it', async () => {
    const onDismiss = reopened();

    // Modality is not what `reason` changes: a near-miss tap must not reach the grade grid whichever
    // way the sheet opened.
    await userEvent.click(screen.getByRole('button', { name: 'Close detail' }));

    expect(onDismiss).toHaveBeenCalled();
  });
});

describe('reopening the tick whose sheet is already open', () => {
  it('drops the countdown when the reason changes without a remount', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    // Exactly how the screens key it. `useGoSheet` goes from {tick: A, logged} to {tick: A, reopened}
    // without passing through undefined, so a key of the tick id alone never changes — the component
    // does not remount, `engaged` stays false from the first mount, and the original five-second timer
    // keeps running under a form the climber deliberately opened. Reachable by keyboard: log a go, Tab
    // to its row, press Enter.
    const sheet = (reason: 'logged' | 'reopened') => (
      <GoSheet
        key={`${tick.id}:${reason}`}
        tick={tick}
        reason={reason}
        annotation={{}}
        {...corrections()}
        onChange={vi.fn()}
        onDismiss={onDismiss}
      />
    );

    const { rerender } = render(sheet('logged'));
    expect(screen.getByTestId('sheet-countdown')).toBeInTheDocument();

    rerender(sheet('reopened'));
    expect(screen.queryByTestId('sheet-countdown')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(SHEET_IDLE_MS * 10);
    });

    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('correcting what was recorded', () => {
  function open(overrides: Partial<Tick> = {}, handlers = corrections()) {
    render(
      <GoSheet
        tick={{ ...tick, ...overrides } as Tick}
        reason="reopened"
        annotation={{}}
        {...handlers}
        onChange={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    return handlers;
  }

  it('states what was recorded, in the words the lists use', () => {
    open();

    const recorded = screen.getByRole('group', { name: 'Recorded as' });
    // The same three facts a recent-ticks row shows, so a go is never described two ways depending on
    // which surface you are looking at.
    expect(recorded).toHaveTextContent('6c+');
    expect(recorded).toHaveTextContent('lead');
    expect(recorded).toHaveTextContent('flashed');
  });

  it('names the prior experience except where the outcome already implies it', () => {
    open({ is_send: true, prior_experience: 'attempted' });

    // A flash *is* a first-go send, so "flashed · first go" would restate the word. A redpoint says
    // nothing about what came before, so it carries it.
    expect(screen.getByRole('group', { name: 'Recorded as' })).toHaveTextContent(
      'sent · tried before',
    );
  });

  it('offers no protection control for a boulder', () => {
    open({ discipline: 'boulder', protection: 'none', grade_scale: 'font', grade_raw: '6A' });

    // `protection: 'none'` *means* boulder, so there is no fourth value to offer — and changing it
    // would cross a discipline and take the grade's notation with it (D17).
    expect(screen.queryByRole('button', { name: /^Protection,/ })).toBeNull();
    // Still stated, though: the sheet says what the go was.
    expect(screen.getByRole('group', { name: 'Recorded as' })).toHaveTextContent('boulder');
  });

  it('opens the grade grid on the tick’s own notation, at its own grade', async () => {
    open({ discipline: 'boulder', protection: 'none', grade_scale: 'font', grade_raw: '6A' });

    await userEvent.click(screen.getByRole('button', { name: 'Grade, 6A' }));

    // Font, not French — case is the only thing separating `6A` from `6a`, so a French grid here would
    // offer the labels of a notation this climb was never graded with.
    expect(screen.getByRole('button', { name: 'Grade 6A' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Grade 6a' })).toBeNull();
    // Marked, so the grid shows where you are rather than only where you can go.
    expect(screen.getByRole('button', { name: 'Grade 6A' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('replaces the detail panel rather than sitting under it', async () => {
    open();
    expect(screen.getByRole('button', { name: 'overhang' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Grade, 6c+' }));

    // One region at a time: the grid is tall, and both at once would put the annotation fields below a
    // fold inside a sheet that already has a fold of its own.
    expect(screen.queryByRole('button', { name: 'overhang' })).toBeNull();
  });

  it('reports a corrected grade and returns to the detail panel', async () => {
    const handlers = open();

    await userEvent.click(screen.getByRole('button', { name: 'Grade, 6c+' }));
    await userEvent.click(screen.getByRole('button', { name: 'Grade 7a' }));

    expect(handlers.onCorrectGrade).toHaveBeenCalledWith('7a');
    expect(screen.getByRole('button', { name: 'overhang' })).toBeInTheDocument();
  });

  it('reports a corrected protection and returns to the detail panel', async () => {
    const handlers = open();

    await userEvent.click(screen.getByRole('button', { name: 'Protection, lead' }));
    await userEvent.click(screen.getByRole('button', { name: 'toprope' }));

    // The failure this whole change exists for: a toprope lap logged under a stale sticky `lead`.
    expect(handlers.onCorrectProtection).toHaveBeenCalledWith('toprope');
    expect(screen.getByRole('button', { name: 'overhang' })).toBeInTheDocument();
  });

  it('reports both halves of a corrected outcome', async () => {
    const handlers = open({ is_send: false, prior_experience: 'attempted' });

    await userEvent.click(screen.getByRole('button', { name: /^Outcome,/ }));
    await userEvent.click(screen.getByRole('button', { name: /first go, flash/i }));

    // Both fields, never one: `TickOutcome` is written whole, and a control reaching only
    // `prior_experience` would leave a go recorded as not sent when it was sent permanently wrong.
    expect(handlers.onCorrectOutcome).toHaveBeenCalledWith({
      prior_experience: 'none',
      is_send: true,
    });
    expect(screen.getByRole('button', { name: 'overhang' })).toBeInTheDocument();
  });

  it('backs out of a correction without reporting one', async () => {
    const handlers = open();

    await userEvent.click(screen.getByRole('button', { name: 'Protection, lead' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(handlers.onCorrectProtection).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'overhang' })).toBeInTheDocument();
  });

  it('closes a control by tapping the fact that opened it', async () => {
    open();

    await userEvent.click(screen.getByRole('button', { name: 'Protection, lead' }));
    expect(screen.getByRole('group', { name: 'Correct protection' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Protection, lead' }));

    expect(screen.queryByRole('group', { name: 'Correct protection' })).toBeNull();
  });

  it('marks which fact is being corrected', async () => {
    open();

    await userEvent.click(screen.getByRole('button', { name: 'Grade, 6c+' }));

    // `aria-pressed` here says "this is what you are editing" rather than "this value is on" — there is
    // no off state for a grade, and the open mode has to be announced rather than only coloured.
    expect(screen.getByRole('button', { name: 'Grade, 6c+' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Protection, lead' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('does not close itself under a correction it followed a write with', async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <GoSheet
        tick={tick}
        reason="logged"
        annotation={{}}
        {...corrections()}
        onChange={vi.fn()}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByTestId('sheet-countdown')).toBeInTheDocument();

    // Opening a correction is a `pointerdown` inside the sheet, which retires the countdown for good.
    // Without that, a five-second clock would run out under a grid somebody is reading.
    act(() => {
      screen
        .getByRole('button', { name: 'Grade, 6c+' })
        .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });
    await act(async () => {
      vi.advanceTimersByTime(SHEET_IDLE_MS * 10);
      await Promise.resolve();
    });

    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.queryByTestId('sheet-countdown')).toBeNull();
  });
});
