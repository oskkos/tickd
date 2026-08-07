import { describe, expect, it, afterEach, vi } from 'vitest';
import { requestPersistence } from './persist.ts';

/**
 * jsdom defines no `navigator.storage` at all, so each test installs the shape it needs and removes
 * it afterwards. `configurable: true` matters — without it the property cannot be redefined and the
 * second test in the file would silently see the first one's stub.
 */
function withStorage(storage: unknown) {
  Object.defineProperty(globalThis.navigator, 'storage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis.navigator, 'storage');
});

describe('requestPersistence', () => {
  it('reports unsupported when the Storage API is absent', async () => {
    // This is jsdom's default and Safari's real behaviour — absence is expected, not an error.
    expect(globalThis.navigator.storage).toBeUndefined();
    await expect(requestPersistence()).resolves.toBe('unsupported');
  });

  it('reports unsupported when storage exists but persist does not', async () => {
    withStorage({ estimate: () => Promise.resolve({}) });
    await expect(requestPersistence()).resolves.toBe('unsupported');
  });

  it('reports persisted when the browser grants it', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    withStorage({ persist });

    await expect(requestPersistence()).resolves.toBe('persisted');
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('reports denied without throwing when the browser refuses', async () => {
    withStorage({ persist: vi.fn().mockResolvedValue(false) });
    // Phase 0 accepts evictable storage, so a refusal must not fail startup.
    await expect(requestPersistence()).resolves.toBe('denied');
  });

  it('swallows a rejected request rather than failing startup', async () => {
    withStorage({ persist: vi.fn().mockRejectedValue(new Error('nope')) });
    await expect(requestPersistence()).resolves.toBe('errored');
  });

  it('requests persistence exactly once per call', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    withStorage({ persist });

    await requestPersistence();
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
