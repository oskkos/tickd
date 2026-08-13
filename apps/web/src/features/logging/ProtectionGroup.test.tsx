import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProtectionGroup } from './ProtectionGroup.tsx';

describe('ProtectionGroup', () => {
  it('offers the three roped protections and never none', () => {
    render(<ProtectionGroup value="lead" onChange={vi.fn()} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['lead', 'toprope', 'autobelay']);
    // `none` *means* boulder, so it is not a fourth way of being roped — offering it would make a
    // boulder-on-lead row expressible from a control (§7.4).
    expect(screen.queryByRole('button', { name: 'none' })).toBeNull();
  });

  it('marks the one in force, and not by colour alone', () => {
    render(<ProtectionGroup value="toprope" onChange={vi.fn()} />);

    // Visibility is the condition DESIGN.md attaches to allowing a sticky protection at all, so the
    // pressed state has to be readable rather than merely tinted.
    expect(screen.getByRole('button', { name: 'toprope' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'lead' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the protection that was tapped', async () => {
    const onChange = vi.fn();
    render(<ProtectionGroup value="lead" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'autobelay' }));

    expect(onChange).toHaveBeenCalledWith('autobelay');
  });

  it('keeps every target above the touch floor', () => {
    render(<ProtectionGroup value="lead" onChange={vi.fn()} />);

    // Chalky fingers, 48px. The class is the contract here; the pixels were measured in a browser.
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveClass('min-h-touch');
    }
  });

  it('can be labelled, so two groups on one screen are distinguishable', () => {
    render(<ProtectionGroup value="lead" onChange={vi.fn()} label="Correct protection" />);

    expect(screen.getByRole('group', { name: 'Correct protection' })).toBeInTheDocument();
  });
});
