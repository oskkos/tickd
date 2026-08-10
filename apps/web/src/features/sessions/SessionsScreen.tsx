/**
 * The Sessions surface.
 *
 * **A heading and nothing else, on purpose, until task group 4.** The tab bar needs a destination
 * before the list exists, and a route with no component is not a thing. What it must *not* do is claim
 * to be finished: no "coming soon" copy, no fake rows, no spinner over an empty read. An empty region
 * is honestly empty.
 */
export function SessionsScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <h2 className="shrink-0 text-2xl">Sessions</h2>
    </div>
  );
}
