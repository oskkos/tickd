import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { Shell } from './Shell.tsx';
import { LoggingScreen } from './features/logging/LoggingScreen.tsx';
import { SessionsScreen } from './features/sessions/SessionsScreen.tsx';
import { SessionDetailScreen } from './features/sessions/SessionDetailScreen.tsx';
import { SettingsScreen } from './features/settings/SettingsScreen.tsx';

/**
 * The route tree, written by hand.
 *
 * **No `@tanstack/router-plugin`, so no `routeTree.gen.ts`.** File-based routing would generate a
 * module that this repository's conventions require to be committed, which would enlist the codegen
 * drift check, the pre-commit hook and CI for every future edit to a tree of four routes. The
 * generated form earns its keep at a scale this is nowhere near.
 *
 * **`/` stays the logging screen.** The manifest's `start_url` is `/` and it is baked into every
 * existing install, so moving the default surface would silently change where an installed app opens.
 *
 * **The detail route is a sibling of the list, not a child.** Nested, `/sessions` would have to render
 * an `<Outlet />` and would frame the detail inside itself; the detail replaces the list instead. Being
 * its own route is also what makes the back gesture work without a second mechanism.
 *
 * Session *selection* is deliberately absent from the tree: which session is open lives in the
 * database, and `openSession` is its only authority. Encoding it in the URL as well would be a second
 * source of truth for exactly the question `startSession`'s transaction was added to settle.
 */
const rootRoute = createRootRoute({ component: Shell });

const logRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LoggingScreen,
});

const sessionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessions',
  component: SessionsScreen,
});

const sessionDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessions/$sessionId',
  component: SessionDetailScreen,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsScreen,
});

const routeTree = rootRoute.addChildren([
  logRoute,
  sessionsRoute,
  sessionDetailRoute,
  settingsRoute,
]);

/**
 * Builds a router.
 *
 * A factory rather than a module-level instance, so a test can start on any route without navigating
 * there first and without one test's history leaking into the next. `initialPath` selects an in-memory
 * history; production passes nothing and gets the browser's.
 */
export function createAppRouter(initialPath?: string) {
  return createRouter({
    routeTree,
    ...(initialPath === undefined
      ? {}
      : { history: createMemoryHistory({ initialEntries: [initialPath] }) }),
  });
}

/**
 * Registers the router's type, which is what makes route paths checked rather than merely strings.
 *
 * `ReturnType` rather than a module-level instance: the factory above exists so tests can build their
 * own, and registering an instance would mean creating one here for the type's sake alone.
 */
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
