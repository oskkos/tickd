import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { labels } from '@tickd/grade-spec';
import { GradeGrid } from './GradeGrid.tsx';

describe('GradeGrid', () => {
  it('renders the whole scale, not just the working range', async () => {
    render(<GradeGrid scale="french" range={{ from: 4, to: 8 }} onPick={vi.fn()} />);

    // 9c must stay reachable even when nobody climbs it — the range positions, it does not truncate.
    expect(await screen.findByRole('button', { name: 'Grade 9c' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(labels('french').length);
  });

  it('renders grades easiest first, in storage order', () => {
    render(<GradeGrid scale="french" onPick={vi.fn()} />);

    const rendered = screen.getAllByRole('button').map((b) => b.textContent);
    expect(rendered).toEqual([...labels('french')]);
  });

  it('renders Font labels verbatim, without case transformation', () => {
    render(<GradeGrid scale="font" onPick={vi.fn()} />);

    // Case is the only thing separating Font 6A from French 6a. A stray uppercase utility would
    // redisplay every French grade as a harder Font one (DESIGN.md §2).
    const six = screen.getByRole('button', { name: 'Grade 6A' });
    expect(six).toHaveTextContent('6A');
    expect(screen.queryByRole('button', { name: 'Grade 6a' })).toBeNull();
  });

  it('marks the working range without hiding anything outside it', () => {
    render(<GradeGrid scale="french" range={{ from: 4, to: 6 }} onPick={vi.fn()} />);

    const inRange = screen.getAllByRole('button').filter((b) => b.dataset.inRange === 'true');
    expect(inRange).toHaveLength(3);
    expect(inRange[0]).toHaveTextContent(labels('french')[4] ?? '');
  });

  it('dims nothing on day one, rather than dimming everything', () => {
    render(<GradeGrid scale="french" onPick={vi.fn()} />);

    // This asserted the opposite until review caught it: `?? Infinity` put every cell out of range
    // with no history, so a first-ever launch rendered all 27 buttons at half opacity. On a phone
    // that reads as "disabled", not "no history yet" — at the one moment the app has to look like it
    // works. No range means no opinion about which grades are yours, not an empty set of them.
    const dimmed = screen.getAllByRole('button').filter((b) => b.dataset.inRange === 'false');
    expect(dimmed).toHaveLength(0);
  });

  it('positions at the working range once it arrives, not only when the scale changes', () => {
    // The range is read from Dexie, so it lands a render *after* the grid mounts. Keyed on `scale`
    // alone, the effect ran once with no anchor to measure and never again — the scroll was dead
    // code for every launch. Rerendering with the same scale is exactly that sequence.
    const { rerender } = render(<GradeGrid scale="french" onPick={vi.fn()} />);
    const container = screen.getByTestId('grade-grid');

    // jsdom reports every offset as 0, so stub the geometry the effect reads.
    const anchorTop = 240;
    vi.spyOn(container, 'offsetTop', 'get').mockReturnValue(0);
    const scrolls: number[] = [];
    vi.spyOn(container, 'scrollTop', 'set').mockImplementation((value: number) => {
      scrolls.push(value);
    });
    vi.spyOn(HTMLButtonElement.prototype, 'offsetTop', 'get').mockReturnValue(anchorTop);

    rerender(<GradeGrid scale="french" range={{ from: 10, to: 14 }} onPick={vi.fn()} />);

    expect(scrolls).toEqual([anchorTop]);
    vi.restoreAllMocks();
  });

  it('reports the grade that was tapped', async () => {
    const onPick = vi.fn();
    render(<GradeGrid scale="french" onPick={onPick} />);

    await userEvent.click(screen.getByRole('button', { name: 'Grade 6c+' }));

    expect(onPick).toHaveBeenCalledWith('6c+');
  });

  it('switches notation with the scale', () => {
    const { rerender } = render(<GradeGrid scale="french" onPick={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(labels('french').length);

    rerender(<GradeGrid scale="font" onPick={vi.fn()} />);

    // 27 French labels become 23 Font ones — a different grid, not a relabelled one (D17).
    expect(screen.getAllByRole('button')).toHaveLength(labels('font').length);
  });
});
