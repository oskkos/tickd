/**
 * Send style, derived rather than stored (D20).
 *
 * `send_style` used to be a column. It is not, and the reason is worth keeping next to the code that
 * replaced it: **a tick records one go**, so a send with no prior experience *is* the first
 * acquaintance and can only be a flash. There is no other possibility. Storing the value would store
 * something computable from the two fields beside it — which is how a value becomes able to disagree
 * with them, and is the error §7.3 forbids for grade ordinals.
 *
 * The consequence is that §7.4's two invalid combinations are unrepresentable rather than merely
 * unreachable. There is no second field left to contradict `prior_experience`, and no way to express a
 * style on a tick that is not a send.
 *
 * `onsight` has no derivation and is gone with the enum. It turns on whether you had beta — a bit
 * `prior_experience` does not carry — and it was already absent from the indoor UI (§6). Outdoor use
 * is what would bring it back, along with a stored style.
 */

import type { TickOutcome } from './types.ts';

/** What a send is called. Not a stored value; the vocabulary for reporting one. */
export type SendStyle = 'flash' | 'redpoint';

/**
 * The style of a go, or `undefined` when it was not a send.
 *
 * Total over every one of the six valid `(prior_experience, is_send)` pairings — there is no input
 * this can reject, which is the point.
 */
export function sendStyleOf(outcome: TickOutcome): SendStyle | undefined {
  if (!outcome.is_send) {
    return undefined;
  }
  return outcome.prior_experience === 'none' ? 'flash' : 'redpoint';
}

/**
 * Whether this go was a flash.
 *
 * Flash rate's numerator (§4.2, D14). Its denominator is every tick with `prior_experience === 'none'`
 * — **including ones never sent**, which is the whole point of dividing by first encounters rather
 * than by sends.
 */
export function isFlash(outcome: TickOutcome): boolean {
  return outcome.is_send && outcome.prior_experience === 'none';
}

/**
 * Whether this go was a first encounter — flash rate's denominator.
 *
 * Deliberately does *not* filter on `is_send`. The climbs you walked away from are what keep the
 * number honest at the limit grade, which is the one thing D14 exists to protect.
 */
export function isFirstEncounter(outcome: TickOutcome): boolean {
  return outcome.prior_experience === 'none';
}

/** A repeat, derived from `prior_experience` and never stored as a column (D6). */
export function isRepeat(outcome: TickOutcome): boolean {
  return outcome.prior_experience === 'sent';
}

/** How a go ended, in the three shapes a reader cares about. */
export type GoOutcome = 'flash' | 'sent' | 'fell';

/**
 * How the go ended — the whole of `(is_send, prior_experience)` collapsed to what gets shown.
 *
 * **Here rather than beside the component that renders it**, because it belongs to the same family as
 * `sendStyleOf` and `isFlash` and every surface must agree with them. Two modules deriving "how did
 * this go end" is how the session summary and a history card come to disagree about the same row.
 *
 * A flash is its own shape rather than a kind of send. It is flash rate's numerator (§4.2, D14), so
 * flattening it into `sent` would make every display of a session disagree with the one metric Phase 0
 * ships.
 */
export function outcomeOf(outcome: TickOutcome): GoOutcome {
  if (!outcome.is_send) {
    return 'fell';
  }
  return isFlash(outcome) ? 'flash' : 'sent';
}
