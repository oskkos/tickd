import { isFlash } from '../../db/style.ts';
import { formatDuration, goesInOrder } from './summary.ts';
import type { Session, Tick, Venue } from '../../db/types.ts';

const LABELS = { flash: 'flashed', sent: 'sent', fell: 'not sent' } as const;

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

/**
 * How a go ended, in three shapes.
 *
 * A flash gets its own mark rather than sharing the send's. It is the thing worth spotting in a
 * session — and it is flash rate's numerator (§4.2, D14), so making it visually distinct from an
 * ordinary send is the summary agreeing with the metric rather than flattening it.
 *
 * Shape carries the meaning and colour only reinforces it: `DESIGN.md` §3 requires colour never to be
 * the only signal, and a summary read at a glance in a changing room is exactly where that matters.
 * `currentColor` throughout, so both themes are covered without a second asset.
 */
function OutcomeIcon({ outcome }: { outcome: 'flash' | 'sent' | 'fell' }) {
  if (outcome === 'flash') {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-4 w-4 text-warning"
        fill="currentColor"
      >
        <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
      </svg>
    );
  }

  const up = outcome === 'sent';
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`h-4 w-4 ${up ? 'text-success' : 'text-base-content/50'}`}
      style={up ? undefined : { transform: 'rotate(180deg)' }}
      fill="currentColor"
    >
      <path d="M2 10h4v11H2zM8 21h9.3a2 2 0 0 0 1.94-1.5l1.7-6.5A1.6 1.6 0 0 0 19.4 11H14l.9-4.3a2 2 0 0 0-3.4-1.8L8 9.4z" />
    </svg>
  );
}

/** The word for a go, used as the accessible label since the icon is hidden. */
function outcomeOf(tick: Tick): 'flash' | 'sent' | 'fell' {
  if (!tick.is_send) {
    return 'fell';
  }
  // Derived, never stored — sent with nothing before it can only be a flash (D20).
  return isFlash(tick) ? 'flash' : 'sent';
}

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
    <div className="flex flex-1 flex-col gap-4">
      <div>
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
        <ul aria-label="Grades climbed" className="flex flex-wrap gap-2">
          {goesInOrder(ticks).map((t) => (
            <li
              key={t.id}
              aria-label={`${t.grade_raw}, ${LABELS[outcomeOf(t)]}`}
              className="rounded-box flex items-center gap-1.5 bg-base-200 px-2.5 py-2 text-sm"
            >
              {/* Verbatim — case separates Font from French (DESIGN.md §2). */}
              <span className="tabular text-base">{t.grade_raw}</span>
              <OutcomeIcon outcome={outcomeOf(t)} />
            </li>
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
