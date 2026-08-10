import { useParams } from '@tanstack/react-router';

/**
 * One session, in full.
 *
 * **The route and its param only, until task group 6.** What earns its place here now is
 * `useParams` — the route declares `$sessionId`, so the id arrives typed rather than as a
 * `string | undefined` pulled out of `location.pathname`. That is the reason the router is TanStack's
 * and not hand-rolled, so it is worth wiring before the screen it serves exists.
 *
 * Addressed by **path string rather than by importing the route object**, which would be the more
 * obvious spelling and would also be a cycle: the route tree imports this component in order to render
 * it. The string is no less typed — `Register` in `router.tsx` is what makes `from` check against the
 * real tree, so a typo here fails the build.
 */
export function SessionDetailScreen() {
  const { sessionId } = useParams({ from: '/sessions/$sessionId' });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <h2 className="shrink-0 text-2xl">Session</h2>
      <p className="sr-only" data-testid="session-id">
        {sessionId}
      </p>
    </div>
  );
}
