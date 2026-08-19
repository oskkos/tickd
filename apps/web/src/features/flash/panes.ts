/**
 * Which panes this screen has, and which one it opens on.
 *
 * Both answers come out of the groups `flashRates` returned, and both are here rather than inside the
 * screen because a screen cannot export a plain function without `react-refresh` objecting — and because
 * they are the two rules the specs argue hardest about, so they are worth testing without a database.
 */

import { PROTECTION_ORDER, type FlashRateGroup } from '../../db/flashRate.ts';
import type { Protection } from '../../db/types.ts';

/**
 * The protections that have a pane, in fixed order.
 *
 * **Membership is *has a group*, and `flashRates` already means *has a first encounter*.** A protection
 * climbed entirely as attempts and repeats produces no group at all, so it is absent from this list
 * without a second condition being written here — which matters, because a second condition is a second
 * definition of the metric's denominator and D14 keeps exactly one.
 *
 * **Absent, never disabled.** A disabled entry implies the surface exists and is being withheld, which is
 * the argument `app-shell` makes for the tab bar and which does not depend on being a tab bar. The cost is
 * that the control changes shape as data arrives; that is the same cost the tab bar already pays for whole
 * surfaces, and design.md accepts it for the same reason.
 *
 * **Ordered from `PROTECTION_ORDER`, never from a second list.** That constant exists in `flashRate.ts`
 * so the selector and the group sort cannot disagree about what order means — a selector whose entries
 * run lead-first over charts sorted boulder-first is a control that appears to jump. Fixed rather than
 * first-appearance is the divergence from `groupGoes` that `PROTECTION_ORDER` documents: a reference
 * screen returned to between climbs must not reorder itself because last night's session began
 * differently.
 */
export function protectionsPresent(groups: readonly FlashRateGroup[]): readonly Protection[] {
  return PROTECTION_ORDER.filter((protection) =>
    groups.some((group) => group.protection === protection),
  );
}

/**
 * The pane to open on: lead when lead has one, otherwise the first that does.
 *
 * **§4.2 names lead as the default, and applying that literally is the bug.** A climber who only boulders
 * would open this screen onto an empty lead pane with their data one tap away — and an empty pane on a
 * screen whose whole job is to show a number reads as "you have no numbers", which is false. So the
 * default is conditional, and the conditional costs nothing: the set of protections with data is already
 * computed to build the selector.
 *
 * `undefined` only when there are no panes at all, which is the screen's empty state rather than a
 * selection problem. Returning `'lead'` as a fallback would hand the caller a pane that does not exist.
 */
export function defaultProtection(protections: readonly Protection[]): Protection | undefined {
  return protections.includes('lead') ? 'lead' : protections[0];
}
