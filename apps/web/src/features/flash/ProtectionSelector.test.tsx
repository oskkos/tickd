import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Protection } from '../../db/types.ts';
import { ProtectionSelector } from './ProtectionSelector.tsx';

function selector(entries: readonly Protection[], value: Protection) {
  const onChange = vi.fn<(protection: Protection) => void>();
  const result = render(<ProtectionSelector entries={entries} value={value} onChange={onChange} />);
  return { ...result, onChange };
}

describe('ProtectionSelector', () => {
  it('carries one entry per protection it was given, in that order', () => {
    selector(['lead', 'toprope', 'autobelay', 'none'], 'lead');

    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Lead',
      'Toprope',
      'Autobelay',
      'Boulder',
    ]);
  });

  it('names boulder as boulder and never as none', () => {
    selector(['lead', 'none'], 'lead');

    // `protection: 'none'` *means* boulder (§7.4), so the control is over the four ways a go is
    // protected, one of which is not being protected. Printing the stored value would offer "no
    // protection" as a fourth way of being roped.
    expect(screen.getByRole('button', { name: 'Boulder' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /none/i })).toBeNull();
  });

  it('leaves out a protection with no data rather than showing it disabled', () => {
    selector(['lead', 'none'], 'lead');

    // A disabled entry implies the surface exists and is being withheld — `app-shell`'s argument for the
    // tab bar, one level down.
    expect(screen.queryByRole('button', { name: 'Toprope' })).toBeNull();
    for (const button of screen.getAllByRole('button')) {
      expect(button).not.toBeDisabled();
    }
  });

  it('renders nothing at all when one protection qualifies', () => {
    const { container } = selector(['none'], 'none');

    // A control that never varies is noise, and it could only ever say what the chart heading below it
    // already says — the call `SessionsScreen` made first about a group heading.
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there is nothing to select', () => {
    const { container } = selector([], 'lead');
    expect(container).toBeEmptyDOMElement();
  });

  it('marks the selected entry as pressed and the others as not', () => {
    selector(['lead', 'toprope'], 'toprope');

    expect(screen.getByRole('button', { name: 'Toprope' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Lead' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the protection that was tapped', async () => {
    const { onChange } = selector(['lead', 'none'], 'lead');

    await userEvent.click(screen.getByRole('button', { name: 'Boulder' }));

    expect(onChange).toHaveBeenCalledWith('none');
  });

  it("keeps the logging screen's target size, since chalky fingers do not change screens", () => {
    selector(['lead', 'toprope'], 'lead');

    // 48px floor, the same class `ProtectionGroup` uses. jsdom reports every height as zero, so the
    // class is what can be asserted here and the device measurement is the real check.
    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('min-h-touch');
    }
  });

  it('groups itself under one name for assistive tech', () => {
    selector(['lead', 'toprope'], 'lead');
    expect(screen.getByRole('group', { name: 'Protection' })).toBeInTheDocument();
  });
});
