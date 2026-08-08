import { Dialog } from '@base-ui/react/dialog';

import { StorageWarning } from './components/StorageWarning.tsx';
import { ThemeSwitch } from './components/ThemeSwitch.tsx';
import { UpdatePrompt } from './components/UpdatePrompt.tsx';
import type { StorageStatus } from './db/startup.ts';

/**
 * Placeholder shell. It exists to prove the stack end to end — install, offline, theming,
 * typography, portals, touch geometry — and deliberately contains no logging flow, no grade grid and
 * no data layer. Those arrive in their own changes.
 */
export function App({ storageStatus = 'ready' }: { storageStatus?: StorageStatus }) {
  return (
    <div className="flex min-h-dvh flex-col bg-base-100 text-base-content">
      <header className="flex items-center justify-between px-4 py-3">
        <h1 className="text-2xl">tickd</h1>
        <ThemeSwitch />
      </header>

      <main className="flex flex-1 flex-col gap-6 px-4 pb-4">
        <StorageWarning status={storageStatus} />

        <p className="text-sm opacity-70">
          Scaffold only. Logging, grades and analytics land in later changes.
        </p>

        {/* Tabular figures: grade and stat columns must not jitter as digits change. */}
        <section className="card bg-base-200">
          <div className="card-body gap-2 p-4">
            <h2 className="text-sm uppercase tracking-wide opacity-70">Tabular figures</h2>
            <div className="tabular flex flex-col text-lg leading-tight">
              <span>6a+ 111 88%</span>
              <span>7c&nbsp;&nbsp; 900 10%</span>
            </div>
          </div>
        </section>

        {/* A portalled dialog renders outside the React root — it must still pick up data-theme. */}
        <Dialog.Root>
          <Dialog.Trigger className="btn btn-outline min-h-touch self-start">
            Open a portalled dialog
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 bg-black/50" />
            {/* NOT `modal-box`: daisyUI ships it at opacity:0 / scale:.95 and only reveals it via a
                `.modal` parent's open state, which Base UI deliberately does not provide. Plain
                utilities over daisyUI's theme tokens instead. */}
            <Dialog.Popup className="rounded-box fixed left-1/2 top-1/2 w-11/12 max-w-md -translate-x-1/2 -translate-y-1/2 bg-base-100 p-6 text-base-content shadow-xl">
              <Dialog.Title className="text-lg">Portalled content</Dialog.Title>
              <Dialog.Description className="py-2 text-sm opacity-70">
                Rendered outside the React root. If this is themed, <code>data-theme</code> is on
                &lt;html&gt; where it belongs.
              </Dialog.Description>
              <Dialog.Close className="btn min-h-touch mt-2">Close</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </main>

      {/* Primary actions live in the lower thumb-reachable third. One-handed use is a requirement,
          not a preference, and a 6.9" screen is the stress case. */}
      <footer className="mt-auto px-4 pb-4">
        <button type="button" className="btn btn-primary min-h-touch-lg w-full text-base" disabled>
          Log a climb — not built yet
        </button>
      </footer>

      <UpdatePrompt />
    </div>
  );
}
