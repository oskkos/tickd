import { createContext, useContext } from 'react';
import type { StartupResult } from './db/startup.ts';

/**
 * The boot result, carried to the shell through React rather than through the router.
 *
 * **Deliberately not router context**, which is the idiomatic TanStack place for ambient values. Two
 * reasons, and the second is the decisive one:
 *
 * - `StartupResult` has nothing to do with routing. It is the outcome of opening IndexedDB, seeding
 *   venues and asking for persistence, and it is the same value on every route. Threading it through
 *   route matching would couple the boot sequence to navigation for no gain.
 * - It would be an import cycle. The root route's component *is* the shell, so the shell imports the
 *   route tree to read its context while the route tree imports the shell to render it. ESM tolerates
 *   that; it is still a knot for the next reader to untie.
 *
 * A separate module rather than living beside the shell, because a file exporting both a component and
 * a hook loses fast refresh — the same rule that produced `summary.ts`.
 */
export const StartupContext = createContext<StartupResult>({ status: 'ready' });

/** The boot result. Defaults to `ready`, which is what a test rendering the shell bare should see. */
export function useStartup(): StartupResult {
  return useContext(StartupContext);
}
