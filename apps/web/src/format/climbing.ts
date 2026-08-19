import type { GoOutcome } from '../db/style.ts';
import type { PriorExperience, Protection } from '../db/types.ts';

/**
 * The words for a tick's stored values, in one place.
 *
 * These read as a climber speaks rather than as the enum spells it, and they are shared because two
 * surfaces show the same row: the recent-ticks list while the session is open, and the session detail
 * afterwards. A second vocabulary would mean the same go described two ways depending on which screen
 * you were looking at.
 */

/** `first go` / `tried before` / `done before` — the vocabulary the recent-ticks list established. */
export function priorLabel(prior: PriorExperience): string {
  switch (prior) {
    case 'none':
      return 'first go';
    case 'attempted':
      return 'tried before';
    case 'sent':
      return 'done before';
  }
}

/**
 * How the climb was protected, or `boulder` when it was not.
 *
 * **`protection: 'none'` renders as `boulder`, because that is what it means** (§7.4). Printing the
 * stored value put the literal word "none" in front of the climber — a boulder go read
 * `none · flash · first go` — which offers "no protection" as a fourth way of being roped rather than
 * naming the discipline. It also disambiguates the notation for free: `6a+ toprope` and `6A boulder`
 * cannot be mistaken for each other, so no scale label is needed on a row.
 *
 * **Takes the field, not the row.** It read `tick.protection` and nothing else, and the flash-rate
 * selector names a protection that belongs to an aggregate rather than to any one go — there is no tick
 * to hand it. The alternative was a second function for the bare value, which is how a module that
 * exists to be the single authority on *`none` reads as boulder* acquires a second answer to it.
 */
export function protectionLabel(protection: Protection): string {
  return protection === 'none' ? 'boulder' : protection;
}

/**
 * How a go ended, in words — for the readers who cannot see the mark.
 *
 * Every surface draws the outcome as a shape (a bolt, a thumb) and hides it from assistive tech, so
 * each needs the word somewhere. Shared so a flash is never announced as a plain send on one screen
 * and distinguished on another; a flash is flash rate's numerator and the two are not the same event.
 */
export function outcomeWord(outcome: GoOutcome): string {
  switch (outcome) {
    case 'flash':
      return 'flashed';
    case 'sent':
      return 'sent';
    case 'fell':
      return 'not sent';
  }
}
