import type { LazyCloseResult } from '../db/sessions.ts';

/**
 * Says when a session left running was closed on this launch.
 *
 * A session quietly appearing in history that the climber never ended reads like the app inventing
 * data — and a discarded empty one reads like a session that failed to save. Neither is true, and
 * both are cheap to say.
 */
// `| undefined` is explicit because `exactOptionalPropertyTypes` distinguishes an absent prop from
// one passed as undefined, and `startup.lazyClose` is the latter.
export function ClosedSessionNote({ result }: { result?: LazyCloseResult | undefined }) {
  if (!result?.closed) {
    return null;
  }

  const message =
    result.outcome === 'discarded'
      ? `Your session from ${result.dateLocal ?? 'earlier'} had nothing logged, so it was discarded.`
      : `Closed your session from ${result.dateLocal ?? 'earlier'} — it was left running.`;

  return (
    <p role="status" className="rounded-box bg-base-200 px-4 py-2 text-sm opacity-80">
      {message}
    </p>
  );
}
