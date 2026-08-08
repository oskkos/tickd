import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnnotationPanel } from './AnnotationPanel.tsx';

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
    expect(screen.getAllByRole('button')).toHaveLength(9);
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('requires nothing', () => {
    render(<AnnotationPanel annotation={{}} onChange={vi.fn()} />);

    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAttribute('aria-pressed', 'false');
    }
    expect(screen.getByRole('textbox')).toHaveValue('');
  });
});
