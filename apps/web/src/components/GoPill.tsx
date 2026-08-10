import { outcomeOf, type GoOutcome } from '../db/style.ts';
import type { Tick } from '../db/types.ts';

/**
 * One go, as a pill: the grade it was on and how it ended.
 *
 * **Shared deliberately.** The session summary and the history cards show the same thing, and the
 * alternative — a card that tallies goes by grade — was rejected because rolling a flash and a fall
 * into `6a ×2` discards the distinction the outcome model exists to record. Once the card shows every
 * go, it is showing the summary's pill, so there is one component rather than two that drift.
 *
 * **Renders an `<li>` and must sit inside a list.** The accessible name lives on the item, so keeping
 * the element here is what stops a second call site from labelling it differently.
 */

/** How a go ended, in three shapes and never by colour alone. */
const LABELS: Record<GoOutcome, string> = {
  flash: 'flashed',
  sent: 'sent',
  fell: 'not sent',
};

/**
 * The mark.
 *
 * Shape carries the meaning and colour only reinforces it: `DESIGN.md` §3 requires colour never to be
 * the only signal, and a session read at a glance in a changing room is exactly where that matters.
 * `currentColor` throughout, so both themes are covered without a second asset.
 */
function OutcomeIcon({ outcome }: { outcome: GoOutcome }) {
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

export function GoPill({ tick }: { tick: Tick }) {
  const outcome = outcomeOf(tick);

  return (
    <li
      aria-label={`${tick.grade_raw}, ${LABELS[outcome]}`}
      className="rounded-box flex items-center gap-1.5 bg-base-200 px-2.5 py-2 text-sm"
    >
      {/* Verbatim — case is the only thing separating Font `6A` from French `6a`, so a
          `text-transform` here would redisplay every French grade as a harder Font one
          (`DESIGN.md` §2, §7.3). */}
      <span className="tabular text-base">{tick.grade_raw}</span>
      <OutcomeIcon outcome={outcome} />
    </li>
  );
}
