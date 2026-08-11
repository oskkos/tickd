import { outcomeOf } from '../db/style.ts';
import { outcomeWord } from '../format/climbing.ts';
import { OutcomeIcon } from './OutcomeIcon.tsx';
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

export function GoPill({ tick }: { tick: Tick }) {
  const outcome = outcomeOf(tick);

  return (
    <li
      aria-label={`${tick.grade_raw}, ${outcomeWord(outcome)}`}
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
