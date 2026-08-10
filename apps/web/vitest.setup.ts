import '@testing-library/jest-dom/vitest';
// jsdom implements no IndexedDB at all — `globalThis.indexedDB` is undefined — so without this the
// storage layer would be the one part of the app that ships untested. Measured, not assumed.
import 'fake-indexeddb/auto';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Testing Library only self-registers cleanup when Vitest globals are enabled. They are not
// (`globals: false` in vite.config.ts), so without this the previous test's DOM leaks into the next
// one and role queries start matching twice.
afterEach(cleanup);

/**
 * jsdom ships no `ResizeObserver`, so merely constructing one throws.
 *
 * A stub rather than a working implementation, and the distinction matters: jsdom has no layout
 * engine, so there is no resize for it to observe and nothing it could report. The grade grid uses
 * one to decide whether grades continue below the fold — a question only a real browser can answer,
 * which is why that behaviour is verified by measurement in Chromium and only its CSS contract is
 * asserted here. This keeps the component from crashing the suite; it does not pretend to test it.
 */
class ResizeObserverStub {
  observe() {
    /* no layout to observe */
  }
  unobserve() {
    /* no-op */
  }
  disconnect() {
    /* no-op */
  }
}
// Unconditional, not `??=`. The DOM lib types `ResizeObserver` as always present, so a guard reads as
// dead code to the linter while being the opposite at runtime — jsdom has never defined it. This file
// only ever runs under jsdom, so there is nothing here to preserve.
globalThis.ResizeObserver = ResizeObserverStub;

// `virtual:pwa-register/react` is supplied by vite-plugin-pwa at build time and has no service
// worker to talk to under jsdom.
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));
