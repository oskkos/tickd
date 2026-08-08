import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from './App.tsx';

describe('App shell', () => {
  it('renders the app name', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'tickd' })).toBeInTheDocument();
  });

  it('offers a theme switch', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument();
  });

  it('renders portalled dialog content, without daisyUI classes that ship invisible', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /open a portalled dialog/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/portalled content/i)).toBeInTheDocument();

    // `modal-box` sets opacity:0 and only becomes visible through a `.modal` parent's open state,
    // which Base UI does not provide. jsdom cannot see stylesheet opacity, so guard the class name.
    expect(dialog.className).not.toMatch(/\bmodal-box\b/);
  });
});

describe('storage warning', () => {
  it('says nothing when storage is ready', () => {
    render(<App storageStatus="ready" />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('tells the user the logbook cannot save when storage is unavailable', () => {
    render(<App storageStatus="unavailable" />);
    // An empty venue picker with no message reads as data loss. Saying so is the whole point.
    expect(screen.getByRole('alert')).toHaveTextContent(/will not let tickd store anything/i);
  });

  it('names the likely cause on a timeout, since it is user-fixable', () => {
    render(<App storageStatus="timeout" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/another tab/i);
  });
});
