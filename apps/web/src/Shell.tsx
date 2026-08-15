import { Outlet } from '@tanstack/react-router';
import { ClosedSessionNote } from './components/ClosedSessionNote.tsx';
import { Logo } from './components/Logo.tsx';
import { StorageWarning } from './components/StorageWarning.tsx';
import { TabBar } from './components/TabBar.tsx';
import { UpdatePrompt } from './components/UpdatePrompt.tsx';
import { useStartup } from './startupContext.ts';

/**
 * The frame every screen renders inside: header, the routed surface, the tab bar.
 *
 * This is the root route's component rather than a wrapper around the router, and it has to be —
 * `TabBar` uses `Link`, which needs router context, so anything that navigates must be *inside*
 * `RouterProvider` rather than around it.
 *
 * The boot notices sit above the outlet rather than inside a screen: they are shell-level facts about
 * whether the database is usable at all, and they must be visible on whichever surface the app opened
 * on. When storage is unusable, an empty venue picker with no message reads as data loss.
 */
export function Shell() {
  const startup = useStartup();

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

      The tab bar takes its height out of `main` from here, which is why the grade grid's floor is
      measured in a real browser rather than assumed to survive the addition.
    */
    <div className="flex h-dvh flex-col overflow-hidden bg-base-100 text-base-content">
      {/* `py-2` rather than `py-3`: eight pixels, paid to the logging screen. With the tab bar taking
          57px off `main`, the grade grid sits exactly on its floor and everything below it competes for
          what is left — and the shell's own chrome is the right place to find it, ahead of anything the
          climber taps. */}
      {/* The theme control used to sit here and now lives on the settings surface, which is where
          `ThemeSwitch` always said it belonged. Its `min-h-touch` was what set this header's height, so
          the header is shorter without it and the grade grid below has more room than the floor it was
          measured against — re-measured at 412×600 rather than assumed. */}
      <header className="flex shrink-0 items-center px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        {/* The wordmark is the heading — the visible name and the accessible one are the same
            string, so `alt="tickd"` inside carries it. */}
        <h1 className="flex">
          <Logo />
        </h1>
      </header>

      {/* `relative` so the update prompt can anchor to the bottom of *this* box rather than to the
          viewport. Anchored to the viewport it landed on top of the tab bar — measured at 412×600, 41px
          of the bar's 57px, with `elementFromPoint` reporting both tabs unreachable. It did not push the
          bar anywhere; it stole the taps. */}
      <main className="relative flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4">
        <StorageWarning status={startup.status} />
        <ClosedSessionNote result={startup.lazyClose} />
        <Outlet />
        {/* Inside `main`, so the bar below it stays reachable while the prompt is up. In flow between the
            two instead would be worse: at 412×600 `main` has no spare height — the grade grid is already
            on its floor — so a ~112px prompt would have to come out of something that cannot yield. */}
        <UpdatePrompt />
      </main>

      <TabBar />
    </div>
  );
}
