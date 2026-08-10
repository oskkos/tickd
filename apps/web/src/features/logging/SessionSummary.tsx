import { GoPill } from '../../components/GoPill.tsx';
import { isFlash } from '../../db/style.ts';
import { formatDuration, goesInOrder } from './summary.ts';
import type { Session, Tick, Venue } from '../../db/types.ts';

/**
 * What the session contained, shown before it closes.
 *
 * **The confirmation is not ceremony.** Ending is destructive of the current context and reachable by
 * mis-tap like anything else — and it is the one moment where reviewing the session makes sense,
 * because the climber has stopped rather than being mid-log. The guard and the review are the same
 * screen, so the safety step earns its keep.
 *
 * **Nothing here is enterable, deliberately.** `conditions` and `felt` were dropped from the session
 * (D21) and Phase 0 has no session-level note — `session_note` is Phase 2. So a locker-room thought
 * has nowhere to live yet, and inventing a field here would reverse a decision through the back door.
 *
 * No flash rate either. Over one session it is a sample of a handful, and Phase 0 ships exactly one
 * analytic on its own screen (§5) — putting a version of it here would smuggle it in early and at its
 * least trustworthy.
 */

export function SessionSummary({
  session,
  venue,
  ticks,
  now,
  onConfirm,
  onCancel,
}: {
  session: Session;
  venue?: Venue | undefined;
  ticks: readonly Tick[];
  now: Date;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const empty = ticks.length === 0;
  const sends = ticks.filter((t) => t.is_send).length;
  const flashes = ticks.filter(isFlash).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="shrink-0">
        <h2 className="text-2xl">{venue?.name ?? 'Session'}</h2>
        <p className="text-sm opacity-70">
          {formatDuration(now.getTime() - session.started_at)} · {ticks.length}{' '}
          {ticks.length === 1 ? 'tick' : 'ticks'}
          {!empty && ` · ${String(sends)} sent · ${String(flashes)} flashed`}
        </p>
      </div>

      {empty ? (
        // Said plainly rather than discovered later: an empty session is discarded, and finding
        // nothing in history afterwards would otherwise read as data loss.
        <p className="rounded-box bg-base-200 px-4 py-3 text-sm">
          Nothing logged, so this session won&rsquo;t be kept.
        </p>
      ) : (
        // One entry per go, so a long evening is a long list. It scrolls itself rather than pushing
        // End session out of the thumb zone, now that the shell is bounded to the viewport.
        <ul aria-label="Grades climbed" className="flex min-h-0 flex-wrap gap-2 overflow-y-auto">
          {goesInOrder(ticks).map((t) => (
            <GoPill key={t.id} tick={t} />
          ))}
        </ul>
      )}

      {/* Primary action in the lower thumb-reachable third, as everywhere else. */}
      <div className="mt-auto flex flex-col gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="btn btn-primary min-h-touch-lg w-full text-base"
        >
          {empty ? 'Discard session' : 'End session'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost min-h-touch w-full">
          Keep climbing
        </button>
      </div>
    </div>
  );
}
