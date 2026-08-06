import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

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
});
