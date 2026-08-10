import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnnotationPanel } from './AnnotationPanel.tsx';
import type { TickAnnotation } from '../../db/ticks.ts';

describe('AnnotationPanel', () => {
  it('accepts at most one angle', async () => {
    const onChange = vi.fn();
    render(<AnnotationPanel annotation={{ angle: 'slab' }} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'overhang' }));

    // Angle is roughly exclusive and is the one that groups, so it replaces rather than accumulates.
    expect(onChange).toHaveBeenCalledWith({ angle: 'overhang' });
  });

  it('clears the angle when the selected one is tapped again', async () => {
    const onChange = vi.fn();
    render(<AnnotationPanel annotation={{ angle: 'slab' }} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'slab' }));

    expect(onChange).toHaveBeenCalledWith({ angle: undefined });
  });

  it('accumulates holds, because a route can be several things at once', async () => {
    const onChange = vi.fn();
    render(<AnnotationPanel annotation={{ holds: ['crimp'] }} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'sloper' }));

    expect(onChange).toHaveBeenCalledWith({ holds: ['crimp', 'sloper'] });
  });

  it('removes a hold that is tapped again', async () => {
    const onChange = vi.fn();
    render(<AnnotationPanel annotation={{ holds: ['crimp', 'sloper'] }} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'crimp' }));

    expect(onChange).toHaveBeenCalledWith({ holds: ['sloper'] });
  });

  it('offers a fixed vocabulary rather than free text for characteristics', () => {
    render(<AnnotationPanel annotation={{}} onChange={vi.fn()} />);

    // Free text fragments — overhang / overhung / roof / steep are one concept and four strings.
    // 4 angles + 5 holds + 3 opinions + 5 stars.
    expect(screen.getAllByRole('button')).toHaveLength(17);
  });

  it('judges the grade without overwriting it', async () => {
    const onChange = vi.fn();
    render(<AnnotationPanel annotation={{}} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'soft' }));

    // An opinion, not an alternative grade: grade_raw records what was on the tag, and §7.3 forbids
    // replacing what was entered with an interpretation of it.
    expect(onChange).toHaveBeenCalledWith({ grade_opinion: 'soft' });
  });

  it('records a rating and clears it on a second tap', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<AnnotationPanel annotation={{}} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: '4 stars' }));
    expect(onChange).toHaveBeenCalledWith({ rating: 4 });

    rerender(<AnnotationPanel annotation={{ rating: 4 }} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: '4 stars' }));
    expect(onChange).toHaveBeenLastCalledWith({ rating: undefined });
  });

  it('lights every star up to the rating, not just the one tapped', () => {
    render(<AnnotationPanel annotation={{ rating: 3 }} onChange={vi.fn()} />);

    const lit = [1, 2, 3].map((n) =>
      screen.getByRole('button', { name: `${String(n)} star${n === 1 ? '' : 's'}` }),
    );
    for (const star of lit) {
      expect(star).toHaveAttribute('aria-pressed', 'true');
      // Filled versus outlined, so the rating is legible without relying on colour (DESIGN.md §3).
      expect(star).toHaveTextContent('★');
    }

    const dim = screen.getByRole('button', { name: '4 stars' });
    expect(dim).toHaveAttribute('aria-pressed', 'false');
    expect(dim).toHaveTextContent('☆');
  });

  it('accepts a length in metres', async () => {
    // A stateful harness, because the field is controlled: without feeding the value back, every
    // keystroke would land in an empty input and "18" would arrive as 8.
    const seen: TickAnnotation[] = [];
    function Harness() {
      const [annotation, setAnnotation] = useState<TickAnnotation>({});
      return (
        <AnnotationPanel
          annotation={annotation}
          onChange={(next) => {
            seen.push(next);
            setAnnotation(next);
          }}
        />
      );
    }
    render(<Harness />);

    await userEvent.type(screen.getByRole('spinbutton', { name: /length in metres/i }), '18');

    expect(seen.at(-1)).toEqual({ length_m: 18 });
  });

  it('treats a cleared length as absent rather than zero', async () => {
    const onChange = vi.fn();
    render(<AnnotationPanel annotation={{ length_m: 18 }} onChange={onChange} />);

    await userEvent.clear(screen.getByRole('spinbutton', { name: /length in metres/i }));

    // A stored 0 would be a wall of no height, which is worse than not knowing.
    expect(onChange).toHaveBeenLastCalledWith({ length_m: undefined });
  });

  it('requires nothing', () => {
    render(<AnnotationPanel annotation={{}} onChange={vi.fn()} />);

    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAttribute('aria-pressed', 'false');
    }
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByRole('spinbutton', { name: /length in metres/i })).toHaveValue(null);
  });
});
