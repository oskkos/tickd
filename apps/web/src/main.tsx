import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.tsx';
import { initialiseStorage } from './db/startup.ts';
import {
  applyTheme,
  readThemePreference,
  resolveTheme,
  systemPrefersDark,
  watchSystemTheme,
} from './features/settings/preferences.ts';
import './index.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('#root missing from index.html');
}

// Seeding is awaited before the first render so no screen can observe an empty venue list, which is
// the one state that looks like data loss rather than a cold start. `initialiseStorage` never
// rejects and never hangs — it is bounded by a timeout, so a blocked or stuck IndexedDB open costs a
// few seconds and a warning rather than a permanently blank page. Persistence is requested inside
// without being awaited.
//
// The status is passed down rather than logged: when storage is unusable the app must say so, or an
// empty venue picker reads as data loss.
const startup = await initialiseStorage();

// The theme, for the whole app rather than for the one screen that can change it.
//
// `index.html` applies the stored theme before first paint and is the only reason there is no flash;
// this re-applies it in case that script could not run (storage blocked, `matchMedia` absent), and then
// keeps *follow system* tracking the system for as long as the app is open. `ThemeControl` is mounted
// only on `/settings`, so a subscription owned by it would stop following the moment the user navigates
// away — which is every moment they are actually logging.
applyTheme(resolveTheme(readThemePreference(), systemPrefersDark()));
watchSystemTheme();

createRoot(root).render(
  <StrictMode>
    <App startup={startup} />
  </StrictMode>,
);
