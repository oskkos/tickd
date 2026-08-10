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
    /*
      **`h-dvh`, not `min-h-dvh`, and that is load-bearing.** The grade grid is a scroll container
      that positions itself at the climber's working range, which requires a bounded height to
      scroll within. Under `min-h-dvh` nothing bounded it: the grid rendered at its full natural
      height, `scrollHeight === clientHeight`, and the effect's `container.scrollTop = …` was a
      silent no-op while the *page* grew and scrolled instead. Measured in a real browser at
      412×600 — 496/496 in the grid, 819 in the document. Found on a phone, not by a test: jsdom
      has no layout engine, so it reports every height as 0 and cannot tell the two apart.

      `dvh` rather than `vh` so mobile browser chrome collapsing does not crop the thumb zone.
      Every descendant that must be allowed to shrink below its content needs `min-h-0` too —
      flex items default to `min-height: auto`, which is what silently defeats `overflow-y-auto`.
    */
    <div className="flex h-dvh flex-col overflow-hidden bg-base-100 text-base-content">
      <header className="flex shrink-0 items-center justify-between px-4 py-3">
        {/* The wordmark is the heading — the visible name and the accessible one are the same
            string, so `alt="tickd"` inside carries it. */}
        <h1 className="flex">
          <Logo />
        </h1>
        <ThemeSwitch />
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4">
        <StorageWarning status={startup.status} />
        <ClosedSessionNote result={startup.lazyClose} />
        <LoggingScreen />
      </main>

      <UpdatePrompt />
    </div>
  );
}
