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
// rejects and never hangs — it is bounded by a timeout, so a blocked or stuck IndexedDB open costs a
// few seconds and a warning rather than a permanently blank page. Persistence is requested inside
// without being awaited.
//
// The status is passed down rather than logged: when storage is unusable the app must say so, or an
// empty venue picker reads as data loss.
const storageStatus = await initialiseStorage();

createRoot(root).render(
  <StrictMode>
    <App storageStatus={storageStatus} />
  </StrictMode>,
);
