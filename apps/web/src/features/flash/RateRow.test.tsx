import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FlashRateRow } from '../../db/flashRate.ts';
import { isChartable, MIN_ENCOUNTERS } from './chartable.ts';
import { RateRow } from './RateRow.tsx';

const row = (label: string, flashes: number, encounters: number): FlashRateRow => ({
  label,
  flashes,
  encounters,
});

/** Rows render an `<li>`, so they need a list to sit in — `GoPill`'s arrangement. */
function renderRow(r: FlashRateRow) {
  return render(
    <ul>
      <RateRow row={r} />
    </ul>,
  );
}

/** The fill's rendered width, or `undefined` when no fill was drawn at all. */
function fillWidth(container: HTMLElement): string | undefined {
  return container.querySelector<HTMLElement>('[data-testid="fill"]')?.style.width;
}

describe('RateRow', () => {
  it('draws a fill proportional to the rate', () => {
    const { container } = renderRow(row('6c', 3, 8));

    // 3/8 = 37.5%, rounded. Asserted as the rendered width rather than as a class, because the width is
    // the claim the reader reads against the chart's 50% rule.
    expect(fillWidth(container)).toBe('38%');
  });

  it('draws an empty fill for a grade met and never flashed, which is a measurement', () => {
    const { container } = renderRow(row('7a', 0, 6));

    // `0/6` is a real zero: six first encounters, none of them flashed. It keeps its track and its fill
    // element at zero width, so it reads as measured rather than as absent — a grade never met is not a
    // row at all, it is inside a `GapRow`.
    expect(fillWidth(container)).toBe('0%');
    expect(container.querySelector('[data-chartable="true"]')).toBeInTheDocument();
  });

  it('draws no fill at all below three first encounters', () => {
    const { container } = renderRow(row('7b', 1, 1));

    // The failure this prevents: at 100% a full-length bar would be the longest on the screen, at the
    // hardest grade on it, from one soft climb (D26).
    expect(fillWidth(container)).toBeUndefined();
    expect(container.querySelector('[data-chartable="false"]')).toBeInTheDocument();
  });

  it('draws a fill at exactly three, the boundary the rule is stated at', () => {
    const { container } = renderRow(row('6b', 1, MIN_ENCOUNTERS));

    expect(fillWidth(container)).toBe('33%');
  });

  it('shows the counts in every state, including the suppressed one', () => {
    // §4.2 shows the rate with its raw counts precisely so the reader can judge a thin cell themselves.
    renderRow(row('7b', 1, 1));
    expect(screen.getByText('1/1')).toBeInTheDocument();

    renderRow(row('6a', 8, 9));
    expect(screen.getByText('8/9')).toBeInTheDocument();
  });

  it('says why a suppressed row has no bar, rather than only omitting the bar', () => {
    renderRow(row('7b', 2, 2));

    // The absent fill cannot be observed by a reader who is not looking at it, so the state is words as
    // well as geometry — and never colour, per `DESIGN.md` §3.
    expect(screen.getByText('too few')).toBeInTheDocument();
    expect(screen.getByLabelText('7b, 2 of 2 flashed, too few to chart')).toBeInTheDocument();
  });

  it('names a chartable row without the suppression phrase', () => {
    renderRow(row('6c', 3, 8));

    expect(screen.getByLabelText('6c, 3 of 8 flashed')).toBeInTheDocument();
  });

  it('renders the grade verbatim, so Font and French stay apart', () => {
    renderRow(row('6A', 4, 5));

    // `6A` is a Font grade and `6a` a much easier French one; a `text-transform` on this path would
    // redisplay one as the other (§7.3, `DESIGN.md` §2).
    const text = screen.getByText('6A');
    expect(text.className).not.toMatch(/uppercase|lowercase|capitalize/);
  });

  it('distinguishes the three states without relying on colour', () => {
    const { container: filled } = renderRow(row('6a', 8, 9));
    const { container: realZero } = renderRow(row('7a', 0, 6));
    const { container: suppressed } = renderRow(row('7b', 1, 1));

    // A real zero and a filled row share a solid track and differ in fill width; a suppressed row has no
    // fill element and a dashed track. Three distinguishable renderings, none of them a hue swap.
    expect(fillWidth(filled)).toBe('89%');
    expect(fillWidth(realZero)).toBe('0%');
    expect(fillWidth(suppressed)).toBeUndefined();

    const trackOf = (c: HTMLElement) => c.querySelector('[data-chartable]')?.className ?? '';
    expect(trackOf(realZero)).toContain('bg-base-300');
    expect(trackOf(suppressed)).toContain('border-dashed');
  });
});

describe('isChartable', () => {
  it('is the stated boundary and nothing else', () => {
    // The rule is derived rather than tuned: below three, a rate can only take extreme values, so its
    // position relative to the 50% rule carries no information (D26). Pinned so the boundary cannot
    // drift silently between the row and the chart.
    expect(MIN_ENCOUNTERS).toBe(3);

    expect(isChartable(row('a', 0, 0))).toBe(false);
    expect(isChartable(row('a', 1, 1))).toBe(false);
    expect(isChartable(row('a', 2, 2))).toBe(false);
    expect(isChartable(row('a', 0, 3))).toBe(true);
    expect(isChartable(row('a', 3, 3))).toBe(true);
  });
});
