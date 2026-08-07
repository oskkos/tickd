import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.tsx';
import { initialiseStorage } from './db/startup.ts';
import './index.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('#root missing from index.html');
}

// Seeding is awaited before the first render so no screen can observe an empty venue list, which is
// the one state that looks like data loss rather than a cold start. `initialiseStorage` never
// rejects — if IndexedDB is unavailable the app still renders, because a white screen tells the user
// nothing. Persistence is requested inside without being awaited.
await initialiseStorage();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
