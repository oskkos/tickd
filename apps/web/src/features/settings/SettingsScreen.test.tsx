import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../testing/renderApp.tsx';
import { db } from '../../db/schema.ts';
import { seedVenues } from '../../db/seed.ts';
import { startSession } from '../../db/sessions.ts';
import { logTick } from '../../db/ticks.ts';

/** Installs a Storage API whose `persisted` answers as told, and records whether `persist` was called. */
function withStorage(storage: unknown) {
  Object.defineProperty(globalThis.navigator, 'storage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}

beforeEach(async () => {
  globalThis.localStorage.clear();
  await db.venues.clear();
  await db.sessions.clear();
  await db.ticks.clear();
  await seedVenues(db);
  withStorage({ persist: vi.fn(), persisted: vi.fn().mockResolvedValue(true) });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis.navigator, 'storage');
  vi.restoreAllMocks();
});

describe('the settings surface', () => {
  it('is reachable at its own URL', async () => {
    await renderApp({ initialPath: '/settings' });
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });

  it('marks its tab as current', async () => {
    await renderApp({ initialPath: '/settings' });

    const bar = screen.getByTestId('tab-bar');
    expect(within(bar).getByRole('link', { name: /settings/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('is reachable from the tab bar', async () => {
    await renderApp();
    await userEvent.click(screen.getByRole('link', { name: /settings/i }));

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });

  it('puts appearance first and the irreversible action last', async () => {
    // Frequently touched above rarely touched, and the irreversible action last — on a surface used
    // one-handed, adjacency is the risk.
    await renderApp({ initialPath: '/settings' });
    await screen.findByRole('heading', { name: 'Settings' });

    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Appearance', 'Feedback', 'Your data', 'Starting over']);
  });

  it('offers the theme and haptic controls', async () => {
    await renderApp({ initialPath: '/settings' });
    await screen.findByRole('heading', { name: 'Settings' });

    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'On' })).toBeInTheDocument();
  });
});

describe('the data section', () => {
  it('states what the logbook holds', async () => {
    const [venue] = await db.venues.toArray();
    if (!venue) throw new Error('expected the seed venues');
    const session = await startSession(db, venue.id, new Date());
    await logTick(db, {
      session_id: session.id,
      discipline: 'sport',
      protection: 'lead',
      grade_scale: 'french',
      grade_raw: '6a',
      outcome: { is_send: true, prior_experience: 'none' },
    });

    await renderApp({ initialPath: '/settings' });

    expect(await screen.findByText(/1 tick in 1 session, on this phone only/i)).toBeInTheDocument();
  });

  it('says the logbook lives nowhere else', async () => {
    await renderApp({ initialPath: '/settings' });
    expect(await screen.findByText(/only copy that survives this phone/i)).toBeInTheDocument();
  });
});

describe('the storage state', () => {
  it('reports a protected origin', async () => {
    withStorage({ persist: vi.fn(), persisted: vi.fn().mockResolvedValue(true) });
    await renderApp({ initialPath: '/settings' });

    expect(await screen.findByText(/protected from automatic cleanup/i)).toBeInTheDocument();
  });

  it('names the action for an unprotected one', async () => {
    // The advice is the reason three states are distinguished rather than reduced to a boolean.
    withStorage({ persist: vi.fn(), persisted: vi.fn().mockResolvedValue(false) });
    await renderApp({ initialPath: '/settings' });

    expect(await screen.findByText(/home screen usually earns it protection/i)).toBeInTheDocument();
  });

  it('reports an unsupporting browser as unable rather than as refusing', async () => {
    withStorage({ persist: vi.fn() });
    await renderApp({ initialPath: '/settings' });

    expect(await screen.findByText(/does not offer storage protection/i)).toBeInTheDocument();
  });

  it('never requests persistence', async () => {
    // Startup asks on every launch, so a refusal already retries itself once the PWA is installed. A
    // request from here would repeat what boot did and imply the user's inaction was the problem.
    const persist = vi.fn().mockResolvedValue(true);
    withStorage({ persist, persisted: vi.fn().mockResolvedValue(false) });

    await renderApp({ initialPath: '/settings' });
    await screen.findByText(/not protected/i);

    expect(persist).not.toHaveBeenCalled();
  });
});

describe('export', () => {
  it('downloads a dated file', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:tickd');
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });

    await renderApp({ initialPath: '/settings' });
    await userEvent.click(await screen.findByRole('button', { name: /export json/i }));

    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(/^tickd-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
