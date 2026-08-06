// `vitest/config` re-exports Vite's defineConfig with the `test` block typed.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Icon geometry and colours are specified in DESIGN.md §2 — the maskable 512 keeps its artwork
// inside the centre 80% safe zone, and apple-touch-icon carries an opaque background because iOS
// ignores the manifest.
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
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    css: true,
  },
});
