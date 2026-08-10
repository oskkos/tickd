import { useMemo } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { createAppRouter } from './router.tsx';
import { StartupContext } from './startupContext.ts';
import type { StartupResult } from './db/startup.ts';

/**
 * The app, which is now the router and the boot result around it.
 *
 * The shell moved to `Shell.tsx` and is the root route's component. It had to: `TabBar` navigates with
 * `Link`, so every part of the frame that can be tapped must live *inside* `RouterProvider` rather than
 * wrapping it. This file is what remains — the two things that exist outside routing.
 *
 * The old comment here claimed "There is no router: Phase 0 has one screen, and `build-tooling`'s scope
 * fence keeps it that way until a second one earns the dependency." The Sessions surface is that second
 * screen. The fence itself is unchanged and still holds: a router carries no network dependency, which
 * is what the fence is about — see D22 in `CONCEPT.md` for why the same is not true of TanStack Query.
 *
 * `initialPath` is for tests, which use it to start on a route instead of navigating there first.
 * Production omits it and gets browser history, so the address bar and the back gesture behave.
 */
export function App({
  startup = { status: 'ready' },
  initialPath,
}: {
  startup?: StartupResult;
  initialPath?: string;
}) {
  // The router owns history and a match cache, so rebuilding it per render would reset navigation on
  // any parent re-render.
  const router = useMemo(() => createAppRouter(initialPath), [initialPath]);

  return (
    <StartupContext value={startup}>
      <RouterProvider router={router} />
    </StartupContext>
  );
}
