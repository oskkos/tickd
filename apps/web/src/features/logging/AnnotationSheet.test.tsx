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

  it('does not close while it is being used', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <AnnotationSheet tick={tick} annotation={{}} onChange={vi.fn()} onDismiss={onDismiss} />,
    );

    act(() => {
      vi.advanceTimersByTime(SHEET_IDLE_MS - 500);
    });
    act(() => {
      screen
        .getByRole('button', { name: 'overhang' })
        .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });
    act(() => {
      vi.advanceTimersByTime(SHEET_IDLE_MS - 500);
    });

    // It must never vanish under someone mid-tap. The timer restarts on any interaction inside.
    expect(onDismiss).not.toHaveBeenCalled();
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
