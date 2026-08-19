import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GapRow } from './GapRow.tsx';

function renderGap(labels: readonly string[]) {
  return render(
    <ul>
      <GapRow labels={labels} />
    </ul>,
  );
}

describe('GapRow', () => {
  it('names the single grade when the run is one', () => {
    renderGap(['6b']);

    expect(screen.getByLabelText('6b, none yet')).toBeInTheDocument();
    expect(screen.getByText('6b')).toBeInTheDocument();
  });

  it('names the range and its width when the run is many', () => {
    renderGap(['7a+', '7b', '7b+', '7c', '7c+']);

    // The count is what makes a wide gap distinguishable from a narrow one without drawing it to scale —
    // which is the unbounded-height option this row exists to avoid.
    expect(screen.getByLabelText('7a+–7c+, none yet, 5 grades')).toBeInTheDocument();
    expect(screen.getByText('7a+–7c+')).toBeInTheDocument();
  });

  it('renders no percentage and no bar in either case', () => {
    // `0/0` is not a rate. A gap drawn as a zero-length bar would read as a measured 0%, which is the
    // confusion this row and `RateRow`'s real-zero state exist to keep apart.
    const { container: one } = renderGap(['6b']);
    const { container: many } = renderGap(['6b', '6c']);

    for (const c of [one, many]) {
      expect(c.textContent).not.toMatch(/%/);
      expect(c.querySelector('[data-testid="fill"]')).not.toBeInTheDocument();
      expect(c.querySelector('[data-chartable]')).not.toBeInTheDocument();
    }
  });

  it('separates the range with an en dash, since a hyphen would read as part of a grade', () => {
    renderGap(['6b+', '6c+']);

    // French and Font labels contain `+`, so `6b+-6c+` is ambiguous where `6b+–6c+` is not.
    expect(screen.getByText('6b+–6c+')).toBeInTheDocument();
  });

  it('keeps Font case verbatim', () => {
    renderGap(['6A', '6B']);

    const text = screen.getByText('6A–6B');
    expect(text.className).not.toMatch(/uppercase|lowercase|capitalize/);
  });
});
