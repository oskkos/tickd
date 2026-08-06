import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Testing Library only self-registers cleanup when Vitest globals are enabled. They are not
// (`globals: false` in vite.config.ts), so without this the previous test's DOM leaks into the next
// one and role queries start matching twice.
afterEach(cleanup);

// `virtual:pwa-register/react` is supplied by vite-plugin-pwa at build time and has no service
// worker to talk to under jsdom.
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));
