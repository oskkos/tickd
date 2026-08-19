import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { FlashRateGroup, FlashRateRow } from '../../db/flashRate.ts';
import { COLUMN_WIDTHS, ROW_COLUMNS } from './columns.ts';
import { RateChart } from './RateChart.tsx';

const met = (label: string, flashes: number, encounters: number): FlashRateRow => ({
  label,
  flashes,
  encounters,
});
const unmet = (label: string): FlashRateRow => ({ label, flashes: 0, encounters: 0 });

function chart(rows: readonly FlashRateRow[], over: Partial<FlashRateGroup> = {}) {
  const group: FlashRateGroup = {
    discipline: 'sport',
    scale: 'french',
    protection: 'lead',
    rows,
    ...over,
  };
  return render(<RateChart group={group} />);
}

/** Whether an element carries every class in one of `ROW_COLUMNS`' strings. */
function carries(element: Element | null | undefined, classes: string): boolean {
  return (
    element !== null &&
    element !== undefined &&
    classes.split(' ').every((name) => element.classList.contains(name))
  );
}

/**
 * The three-cell boxes whose columns must agree: every row, the rule's label line, and the rule's overlay.
 *
 * Found structurally rather than by test id, so a box added later is covered without the test being
 * edited — and so the assertion is about *what is rendered*, not about what was tagged for it.
 */
function columnBoxes(container: HTMLElement): readonly Element[] {
  const rows = [...container.querySelectorAll('li')];
  const mirrors = [...container.querySelectorAll('section > div, section > div > div')].filter(
    (box) => box.childElementCount === 3 && box.classList.contains('flex'),
  );
  return [...rows, ...mirrors];
}

describe('RateChart', () => {
  it('names its protection and its scale', () => {
    chart([met('6a', 8, 9)]);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('lead · French');
  });

  it('names the scale even though this is the only chart on screen', () => {
    // The deliberate divergence from `SessionsScreen`, which drops a heading that never varies. There
    // the pills sit inside a visit that supplies context; here the grade column *is* the axis and
    // nothing else tells Font `6A` from French `6a` (§7.3). Pinned so the inconsistency is not later
    // reconciled by deleting the label.
    chart([met('6A', 4, 6)], { discipline: 'boulder', protection: 'none', scale: 'font' });
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('boulder · Font');
  });

  it('heads two disciplines sharing one protection and scale identically, which is accepted', () => {
    const sport = chart([met('6a', 2, 4)], { discipline: 'sport' });
    const trad = chart([met('6a', 2, 4)], { discipline: 'trad' });

    // The group key is `(discipline, scale, protection)` and the heading carries two thirds of it, so this
    // collision is real. Recorded as intended rather than left to be found: it repeats a heading, where
    // `flashRate.ts`'s `isProtection` hazard moves which pane you land on — both charts still compute from
    // their own group, no count is pooled and no rate is wrong. Unreachable from the indoor UI, since
    // `trad` never appears in it (§7.7); reachable from an import, which does no per-field validation (D24).
    const heading = (r: ReturnType<typeof chart>) =>
      r.container.querySelector('h3')?.textContent ?? '';
    expect(heading(sport)).toBe('lead · French');
    expect(heading(trad)).toBe(heading(sport));
  });

  it('draws one row per met grade and one row per run of unmet ones', () => {
    chart([
      met('6a', 8, 9),
      met('6b', 7, 11),
      unmet('6b+'),
      unmet('6c'),
      unmet('6c+'),
      met('7a', 1, 1),
    ]);

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(rows[2]).toHaveAccessibleName('6b+–6c+, none yet, 3 grades');
  });

  it('begins and ends on grades that were actually met', () => {
    // The span's ends are observed by construction in `flashRate.ts`, so a leading or trailing gap
    // cannot occur — asserted here because it is the chart that would show one.
    chart([met('6a', 2, 4), unmet('6a+'), met('6b', 1, 3)]);

    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveAccessibleName('6a, 2 of 4 flashed');
    expect(rows[rows.length - 1]).toHaveAccessibleName('6b, 1 of 3 flashed');
  });

  it('draws exactly one reference rule for the whole chart, not one per row', () => {
    const { container } = chart([met('6a', 8, 9), met('6b', 7, 11), met('6c', 3, 8)]);

    // The point of a fixed track: one x-position means 50% down every row, so the reader finds the
    // crossing by scanning for the row whose fill stops reaching the line. A marker per row would draw
    // the same geometry three times and allow three answers to where 50% is.
    expect(container.querySelectorAll('[data-testid="rule"]')).toHaveLength(1);
  });

  it('leaves a rate above 50% past the rule and one below it short of the rule', () => {
    const { container } = chart([met('6a', 8, 9), met('6c', 3, 8)]);

    // The reading gesture, in the only form jsdom can hold: the rule sits at `left-1/2` of a track whose
    // width does not vary between rows, so a fill of 89% ends past it and one of 38% stops short. Whether
    // the pixels agree is settled in a real browser at 412×600 — jsdom measures every width as zero.
    const fills = [...container.querySelectorAll<HTMLElement>('[data-testid="fill"]')];
    expect(fills.map((fill) => fill.style.width)).toEqual(['89%', '38%']);
    expect(container.querySelector<HTMLElement>('[data-testid="rule"]')?.className).toContain(
      'left-1/2',
    );
  });

  it('labels the rule, since a bare line does not say what it marks', () => {
    chart([met('6a', 8, 9)]);
    expect(screen.getByText('~50%')).toBeInTheDocument();
  });

  it('marks the rule with a line and a label rather than a colour change', () => {
    const { container } = chart([met('6a', 8, 9)]);

    // `DESIGN.md` §3 forbids colour as the only signal — and in a gym colour already means *circuit*.
    // A one-pixel line at the half-way point is position and shape; the label is text.
    const rule = container.querySelector<HTMLElement>('[data-testid="rule"]');
    expect(rule?.className).toContain('w-px');
    expect(rule?.className).toContain('left-1/2');
  });

  it('defines the two column widths its rows read, since nothing else can', () => {
    const { container } = chart([met('6a', 8, 9)]);

    // `RateRow` and `GapRow` size their fixed columns with these variables and a row is never rendered
    // outside a chart, so the chart's container is the one element that scopes both. Undefined, every
    // row's label and counts column collapses to nothing.
    const section = container.querySelector<HTMLElement>('section');
    for (const [property, value] of Object.entries(COLUMN_WIDTHS)) {
      expect(section?.style.getPropertyValue(property)).toBe(value);
    }
  });

  it('sizes every row and the rule overlay from the one set of column classes', () => {
    const { container } = chart([met('6a', 8, 9), unmet('6a+'), met('6b', 1, 3)]);

    // **The finding this test exists for.** The rule is drawn by re-running a row's own flex layout in an
    // overlay, so the line lands inside the rectangle the fills occupy. Let one side spell its own gap or
    // its own label width and the fills move while the rule does not — and the result does not look
    // broken, it looks like bars crossing 50% at a different grade than they do. `columns.ts` makes the
    // divergence impossible; this asserts that every consumer is still reading from it, which is the
    // half a shared constant cannot guarantee on its own.
    const boxes = columnBoxes(container);
    // Two rate rows, a gap row, the rule's label line and the rule's overlay. Counted so a box added
    // later cannot slip past the loop below unasserted.
    expect(boxes).toHaveLength(5);

    for (const box of boxes) {
      expect(carries(box, ROW_COLUMNS.gap)).toBe(true);
      expect(carries(box.firstElementChild, ROW_COLUMNS.label)).toBe(true);
      expect(carries(box.lastElementChild, ROW_COLUMNS.counts)).toBe(true);
    }
  });

  it('gives the rule the same middle cell the fills are drawn in', () => {
    const { container } = chart([met('6a', 8, 9)]);

    const rule = container.querySelector<HTMLElement>('[data-testid="rule"]');
    const trackCell = rule?.parentElement;
    const fill = container.querySelector<HTMLElement>('[data-testid="fill"]');

    // Pairwise, on the axis that matters: the rule's cell and the fill's cell are both the `flex-1`
    // middle between the same two fixed columns, so 50% of one is 50% of the other.
    expect(trackCell?.className).toContain('flex-1');
    expect(fill?.parentElement?.className).toContain('flex-1');
    expect(carries(trackCell?.previousElementSibling, ROW_COLUMNS.label)).toBe(true);
    expect(carries(fill?.parentElement?.previousElementSibling, ROW_COLUMNS.label)).toBe(true);
  });

  it('overlays the rule on the rows instead of stacking it after them', () => {
    const { container } = chart([met('6a', 8, 9), met('6b', 1, 3)]);

    // Without `absolute inset-0` the overlay becomes an ordinary row of empty cells and the rule — sized
    // only by `inset-y-0` — renders nothing at all, while every other assertion in this file still
    // passes: the element is present, its classes are right, its cells agree. Only its position is gone.
    const overlay = container
      .querySelector<HTMLElement>('[data-testid="rule"]')
      ?.closest('div.flex');
    expect(overlay?.className).toContain('absolute');
    expect(overlay?.className).toContain('inset-0');

    // And the box it is absolute *within* is the one holding the rows, so it spans them.
    const spanned = overlay?.parentElement;
    expect(spanned?.className).toContain('relative');
    expect(spanned?.querySelector('ul')).not.toBeNull();
  });

  it('names no grade as a level and offers no crossing, headline or trend', () => {
    const { container } = chart([
      met('6a', 8, 9),
      met('6b', 7, 11),
      met('6c', 3, 8),
      met('7a', 0, 6),
    ]);

    // The mock carried "You cross 50% at 6b+"; §4.2 puts the crossing on the reader precisely because
    // the sample sizes are thin, so a headline would state a conclusion with more confidence than the
    // data supports. Specified as absent because it is the well-meant addition a later reader makes.
    expect(container.textContent).not.toMatch(/cross|level|limit|plateau|trend|median/i);
  });

  it('renders every grade, count and state as text', () => {
    // D25's other half: a canvas chart would make these painted pixels, and this the one Phase 0
    // surface the suite cannot query and a screen reader cannot read.
    chart([met('6c', 3, 8), unmet('6c+'), met('7a', 1, 1)]);

    const list = screen.getByRole('list');
    expect(within(list).getByText('3/8')).toBeInTheDocument();
    expect(within(list).getByText('1/1')).toBeInTheDocument();
    expect(within(list).getByText('too few')).toBeInTheDocument();
    expect(within(list).getByText('6c+')).toBeInTheDocument();
  });

  it('shows no percentage anywhere, since the counts are the claim', () => {
    const { container } = chart([met('6a', 8, 9), unmet('6a+'), met('6b', 1, 1)]);

    // `~50%` is the rule's label, and it is the only per-cent sign the chart is allowed: a per-row
    // percentage would restate a value already computable from the two counts beside it (§7.3's rule
    // about derived values, applied to text).
    expect(container.textContent.match(/%/g)).toHaveLength(1);
  });
});
