import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const updateServiceWorker = vi.fn();
const setNeedRefresh = vi.fn();

/**
 * `needRefresh: true`, overriding the global stub.
 *
 * `vitest.setup.ts` mocks this module with `needRefresh: false`, which is right for every other suite —
 * there is no service worker under jsdom. This file is the one place the prompt has to actually render,
 * so it re-mocks. Hoisted by Vitest above the import below, which is why the spies are declared first.
 */
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [true, setNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  }),
}));

const { UpdatePrompt } = await import('./UpdatePrompt.tsx');
const { createAppRouter } = await import('../router.tsx');
const { RouterProvider } = await import('@tanstack/react-router');

describe('UpdatePrompt', () => {
  it('offers a reload and a way to defer it', async () => {
    render(<UpdatePrompt />);

    expect(screen.getByRole('status')).toHaveTextContent(/new version is ready/i);

    await userEvent.click(screen.getByRole('button', { name: 'Later' }));
    // Never auto-reloads: a reload nobody asked for is indistinguishable from data loss in an app
    // logged in fragments.
    expect(setNeedRefresh).toHaveBeenCalledWith(false);
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });

  it('reloads only when asked', async () => {
    render(<UpdatePrompt />);

    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));

    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('is positioned against its container, never the viewport', () => {
    render(<UpdatePrompt />);

    // `fixed bottom-0` put this card over the bottom tab bar — measured at 412×600 as 41px of the bar's
    // 57px, with `elementFromPoint` reporting both tabs unreachable, so it stole the taps rather than
    // merely hiding them. jsdom has no layout engine, so this guards the cause: the card must be
    // `absolute`, which makes `main` its containing block.
    const card = screen.getByRole('status');
    expect(card).toHaveClass('absolute');
    expect(card).not.toHaveClass('fixed');
  });
});

describe('where the shell puts it', () => {
  it('renders inside main, above the tab bar rather than over it', async () => {
    // Rendered through the real shell, because the bug was entirely about which box the card belongs to.
    const router = createAppRouter('/');
    render(<RouterProvider router={router} />);
    const main = await screen.findByRole('main');

    const card = screen.getByRole('status');
    expect(main.contains(card)).toBe(true);
    expect(main.contains(screen.getByTestId('tab-bar'))).toBe(false);
    // `main` has to establish the containing block, or `absolute` falls through to the viewport and the
    // original bug returns unchanged.
    expect(main).toHaveClass('relative');
  });
});
