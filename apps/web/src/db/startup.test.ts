import { describe, expect, it, vi, afterEach } from 'vitest';

/**
 * These tests mock `./seed.ts` and `./schema.ts`, so they must not share a module registry with the
 * suites that use the real ones. `vi.resetModules()` plus a dynamic import per test keeps them apart.
 */
afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function loadStartup(seedImpl: () => Promise<void>) {
  vi.doMock('./schema.ts', () => ({ db: {} }));
  vi.doMock('./sessions.ts', () => ({ closeIfIdle: () => Promise.resolve({ closed: false }) }));
  vi.doMock('./seed.ts', () => ({ seedVenues: vi.fn(seedImpl) }));
  vi.doMock('./persist.ts', () => ({ requestPersistence: () => Promise.resolve('persisted') }));
  return import('./startup.ts');
}

describe('initialiseStorage', () => {
  it('reports ready when seeding succeeds', async () => {
    const { initialiseStorage } = await loadStartup(() => Promise.resolve());
    await expect(initialiseStorage()).resolves.toEqual({ status: 'ready' });
  });

  it('reports unavailable rather than throwing when IndexedDB rejects', async () => {
    // Firefox private browsing rejects on open. The app still has to render.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { initialiseStorage } = await loadStartup(() => Promise.reject(new Error('denied')));

    await expect(initialiseStorage()).resolves.toEqual({ status: 'unavailable' });
  });

  it('reports timeout rather than hanging when the open never settles', async () => {
    // The gap that had no coverage: a rejecting IndexedDB was handled, a *hanging* one was not.
    // Dexie waits indefinitely on the `blocked` event and on the WebKit no-event bug, so without a
    // bound the awaited promise never settles and first render never happens.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.useFakeTimers();
    const { initialiseStorage } = await loadStartup(() => new Promise<void>(() => undefined));

    const pending = initialiseStorage();
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(pending).resolves.toEqual({ status: 'timeout' });
  });

  it('does not report timeout when seeding finishes inside the window', async () => {
    vi.useFakeTimers();
    const { initialiseStorage } = await loadStartup(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 100);
        }),
    );

    const pending = initialiseStorage();
    await vi.advanceTimersByTimeAsync(200);

    await expect(pending).resolves.toEqual({ status: 'ready' });
  });
});
