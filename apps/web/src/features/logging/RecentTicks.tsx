import { useState } from 'react';
import { sendStyleOf } from '../../db/style.ts';
import { priorLabel, protectionLabel } from '../../format/climbing.ts';
import type { Tick } from '../../db/types.ts';

/**
 * How many goes the list shows before it asks to be expanded.
 *
 * **One — the go just logged.** This started at three, to keep the list short enough not to be a
 * second scroller under the grade grid. Once the count became an expand control, three stopped
 * earning its space: the row that confirms what was just written is the one being looked at, and the
 * two under it are history that the toggle now reaches on demand. Giving that space back to the grid
 * is the trade, since the grid is what gets tapped.
 *
 * It still serves the mis-tap it exists for — a wrong sticky `protection` or a mis-tapped outcome is
 * visible on the row that appears immediately after the tap.
 */
export const RECENT_VISIBLE = 1;

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
  /**
   * Expanded on request, and only then does this list scroll.
   *
   * A cap alone would have made the fourth-oldest go **impossible to undo** — there is no other route
   * to it, and `DESIGN.md` makes undo persistent rather than a toast precisely because the mistake is
   * noticed after the next climb. So the count is a control, not a label. A scrolling region that
   * exists because it was asked for is a different thing from one that is always underfoot.
   */
  const [expanded, setExpanded] = useState(false);

  if (ticks.length === 0) {
    return (
      <p className="shrink-0 text-sm opacity-60">
        Nothing logged yet. Your ticks appear here as you go.
      </p>
    );
  }

  const shown = expanded ? ticks : ticks.slice(0, RECENT_VISIBLE);
  const hidden = ticks.length - shown.length;

  return (
    // Allowed to shrink. `shrink-0` here, against the grid's floor, meant neither could yield on a
    // short viewport: the overflow went off the bottom of the screen and the shell clipped it, so two
    // of three rows were simply unreachable — measured at 711px against a 600px viewport. Losing rows
    // is worse than either scrolling or squeezing.
    <div className="flex min-h-0 flex-col gap-2">
      {(hidden > 0 || expanded) && (
        <button
          type="button"
          onClick={() => {
            setExpanded(!expanded);
          }}
          className="min-h-touch self-start text-sm underline decoration-dotted underline-offset-4 opacity-70"
        >
          {expanded
            ? `Showing all ${String(ticks.length)} goes · show fewer`
            : `${String(ticks.length)} goes · show all`}
        </button>
      )}

      {/*
        `overflow-y-auto` is a last resort, not a design: with three rows and a phone-sized viewport
        there is nothing to scroll, so `auto` does nothing and the grid is the only scroller — which is
        the whole point of the cap. It engages only when the alternative is a row nobody can reach.

        The `max-h` applies when expanded, where scrolling is exactly what was asked for.
      */}
      <ul
        aria-label="Recent ticks"
        className={[
          'flex min-h-0 flex-col gap-2 overflow-y-auto',
          expanded ? 'max-h-[40vh]' : '',
        ].join(' ')}
      >
        {shown.map((tick) => (
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
                {protectionLabel(tick)} · {outcomeLabel(tick)} · {priorLabel(tick.prior_experience)}
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
    </div>
  );
}
