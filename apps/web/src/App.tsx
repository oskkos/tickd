import { ClosedSessionNote } from './components/ClosedSessionNote.tsx';
import { Logo } from './components/Logo.tsx';
import { StorageWarning } from './components/StorageWarning.tsx';
import { LoggingScreen } from './features/logging/LoggingScreen.tsx';
import { ThemeSwitch } from './components/ThemeSwitch.tsx';
import { UpdatePrompt } from './components/UpdatePrompt.tsx';
import type { StartupResult } from './db/startup.ts';

/**
 * The app shell around the logging flow.
 *
 * There is no router: Phase 0 has one screen, and `build-tooling`'s scope fence keeps it that way
 * until a second one earns the dependency.
 */
export function App({ startup = { status: 'ready' } }: { startup?: StartupResult }) {
  return (
    <div className="flex min-h-dvh flex-col bg-base-100 text-base-content">
      <header className="flex items-center justify-between px-4 py-3">
        {/* The wordmark is the heading — the visible name and the accessible one are the same
            string, so `alt="tickd"` inside carries it. */}
        <h1 className="flex">
          <Logo />
        </h1>
        <ThemeSwitch />
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 pb-4">
        <StorageWarning status={startup.status} />
        <ClosedSessionNote result={startup.lazyClose} />
        <LoggingScreen />
      </main>

      <UpdatePrompt />
    </div>
  );
}
