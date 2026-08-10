import { sendStyleOf } from '../../db/style.ts';
import type { Tick } from '../../db/types.ts';

/**
 * The session's ticks, newest first — undo, confirmation and review in one list.
 *
 * **Persistent, not a toast.** §3 makes undo first-class because a two-tap interface maximises
 * mis-taps, and `DESIGN.md` is specific that a notification vanishing after four seconds is useless
 * when the mistake is noticed after the next climb.
 *
 * **Each row shows what was recorded, not just the grade.** Defaults do much of the logging —
 * `protection` is sticky — so this list is the only place a wrong default becomes visible while still
 * standing at the wall.
 */

function priorLabel(tick: Tick): string {
  switch (tick.prior_experience) {
    case 'none':
      return 'first go';
    case 'attempted':
      return 'tried before';
    case 'sent':
      return 'done before';
  }
}

/** What happened, in the vocabulary a climber uses rather than the enum's. */
function outcomeLabel(tick: Tick): string {
  return sendStyleOf(tick) ?? 'fell';
}

export function RecentTicks({
  ticks,
  onRemove,
  onAnnotate,
}: {
  ticks: readonly Tick[];
  onRemove: (id: string) => void;
  onAnnotate: (tick: Tick) => void;
}) {
  if (ticks.length === 0) {
    return (
      <p className="shrink-0 text-sm opacity-60">
        Nothing logged yet. Your ticks appear here as you go.
      </p>
    );
  }

  return (
    /*
      **Capped, and it yields.** The shell is bounded to the viewport so the grade grid can position
      at the working range, which makes this list the other claimant on the same vertical space. Left
      unbounded and unshrinkable it won that contest and squeezed the grid to a single row of grades
      by the eighth go — the grid is tapped all evening, this list is consulted after a mis-tap, so
      `min-h-0` lets this give way while the grid holds its floor.
    */
    <ul
      aria-label="Recent ticks"
      className="flex max-h-[28vh] min-h-0 flex-col gap-2 overflow-y-auto"
    >
      {ticks.map((tick) => (
        <li
          key={tick.id}
          className="rounded-box flex items-center gap-3 bg-base-200 px-3 py-2 text-sm"
        >
          {/*
            The row itself reopens the detail sheet. This is what makes the sheet safe to auto-close:
            nothing is lost when it fades, because the tick is written and its detail is one tap away
            for the rest of the session.
          */}
          <button
            type="button"
            onClick={() => {
              onAnnotate(tick);
            }}
            aria-label={`Detail for ${tick.grade_raw}`}
            className="min-h-touch flex flex-1 items-center gap-3 text-left"
          >
            {/* Verbatim — case separates Font from French (DESIGN.md §2). */}
            <span className="tabular text-lg">{tick.grade_raw}</span>
            <span className="flex-1 opacity-70">
              {tick.protection} · {outcomeLabel(tick)} · {priorLabel(tick)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              onRemove(tick.id);
            }}
            aria-label={`Undo ${tick.grade_raw}`}
            className="btn btn-xs btn-ghost min-h-touch text-error shrink-0"
          >
            Undo
          </button>
        </li>
      ))}
    </ul>
  );
}
