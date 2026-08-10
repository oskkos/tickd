// `vitest/config` re-exports Vite's defineConfig with the `test` block typed.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Icon geometry and colours are specified in DESIGN.md §1 and catalogued in ICONS.md — the maskable
// 512 keeps its artwork inside the centre 80% safe zone, and apple-touch-icon carries an opaque
// background because iOS ignores the manifest. Filenames are the contract: replacing the artwork
// needs no change here as long as they match.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Never reload mid-session: an app logged in fragments cannot afford a surprise refresh.
      // The user is prompted instead. See design.md.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180.png'],
      manifest: {
        name: 'tickd',
        short_name: 'tickd',
        description: 'An indoor climbing logbook. Rope and boulder.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1c212b',
        theme_color: '#1c212b',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Fonts are fingerprinted by Vite and must land in the precache: offline launch has to
        // render in Poppins and Lato, not fallback faces.
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,webmanifest}'],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    /*
      **One test file at a time, because three of them drive real screens against one database.**

      `LoggingScreen`, `SessionsScreen` and `SessionDetailScreen` all import the `db` singleton
      directly — the router constructs them, so there is no prop to inject a different one through —
      and each suite clears and seeds it in `beforeEach`. Run in parallel, one file's `clear()` lands
      between another file's seed and its assertion, and the symptom is a venue picker with no
      venues in a test that seeded four. Measured: flaky in roughly a quarter of full runs, never
      reproducible in a single file.

      **The cost is measured, not negligible: 28s serialised against 6s parallel**, almost all of it
      standing up 24 jsdom environments one after another. That is accepted here because a suite that
      fails a quarter of the time is worth less than a slow one, and because the pre-commit hook does
      not run tests — CI does.

      The better fix, when a fourth database-driven screen makes this hurt, is to reach the database
      through context with the singleton as its default, so each test file can hand the screens their
      own. It is a larger change than this one and worth making deliberately rather than as a
      side-effect of adding a screen.
    */
    fileParallelism: false,
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    css: true,
  },
});
