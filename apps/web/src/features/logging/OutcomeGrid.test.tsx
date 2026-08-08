import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { sendStyleOf } from '../../db/style.ts';
import { OutcomeGrid } from './OutcomeGrid.tsx';

describe('OutcomeGrid', () => {
  it('offers exactly six cells, one per valid outcome', () => {
    render(<OutcomeGrid grade="7a" onCommit={vi.fn()} />);

    // Not five with one disabled — six, because all six are valid (D20).
    expect(screen.getAllByRole('button')).toHaveLength(6);
  });

  it('offers no style control at all', () => {
    render(<OutcomeGrid grade="7a" onCommit={vi.fn()} />);

    // Redpoint, onsight and second go are not choices. Style is derived from what is chosen here.
    for (const word of [/redpoint/i, /onsight/i, /second go/i]) {
      expect(screen.queryByRole('button', { name: word })).toBeNull();
    }
  });

  it('preselects nothing', () => {
    render(<OutcomeGrid grade="7a" onCommit={vi.fn()} />);

    // prior_experience is correct on the first go and wrong on every go after, so a default would be
    // silently wrong most of the time and would inflate flash rate's denominator.
    for (const button of screen.getAllByRole('button')) {
      expect(button).not.toHaveAttribute('aria-pressed', 'true');
      expect(button.getAttribute('data-selected')).toBeNull();
    }
  });

  it('commits a flash from the first-go send, without anyone choosing "flash"', async () => {
    const onCommit = vi.fn();
    render(<OutcomeGrid grade="7a" onCommit={onCommit} />);

    await userEvent.click(screen.getByRole('button', { name: /first go, flash/i }));

    const outcome = onCommit.mock.calls[0]?.[0] as Parameters<typeof sendStyleOf>[0];
    expect(outcome).toEqual({ prior_experience: 'none', is_send: true });
    expect(sendStyleOf(outcome)).toBe('flash');
  });

  it('commits a first encounter that was not sent — the honest denominator', async () => {
    const onCommit = vi.fn();
    render(<OutcomeGrid grade="7a" onCommit={onCommit} />);

    await userEvent.click(screen.getByRole('button', { name: /first go, fell/i }));

    // The row D14 exists to protect: in the denominator, out of the numerator.
    expect(onCommit).toHaveBeenCalledWith({ prior_experience: 'none', is_send: false });
  });

  it('derives a redpoint from a send with prior experience', async () => {
    const onCommit = vi.fn();
    render(<OutcomeGrid grade="7a" onCommit={onCommit} />);

    await userEvent.click(screen.getByRole('button', { name: /tried it, sent/i }));

    const outcome = onCommit.mock.calls[0]?.[0] as Parameters<typeof sendStyleOf>[0];
    expect(sendStyleOf(outcome)).toBe('redpoint');
  });

  it('commits on the cell tap, with no confirm step', async () => {
    const onCommit = vi.fn();
    render(<OutcomeGrid grade="7a" onCommit={onCommit} />);

    await userEvent.click(screen.getByRole('button', { name: /sent it, sent/i }));

    // One tap, already written. An uncommitted tick is a tick you can lose when someone hands you a
    // rope, which is why §4 requires every tap to persist immediately.
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /tick it|confirm|save|submit/i })).toBeNull();
  });

  it('shows the grade verbatim', () => {
    render(<OutcomeGrid grade="6A" onCommit={vi.fn()} />);

    expect(screen.getByTestId('outcome-grade')).toHaveTextContent('6A');
  });
});
