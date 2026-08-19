/**
 * When a flash rate may be drawn as a bar (D26).
 *
 * **A presentation rule, deliberately outside `db/`.** `flashRate.ts` reports counts and nothing else,
 * so that suppression cannot quietly become a change to the data: the denominator D14 defines is
 * untouched, no tick is excluded, and every row still carries its counts. What is withdrawn here is only
 * the bar's *claim* about where the rate falls, which keeps D6's *segment, never exclude* intact.
 *
 * It lives in its own module rather than beside the row that renders it because the chart needs the same
 * boundary — it decides which rows get a fill, and a second copy of the number is how a chart comes to
 * disagree with its own rows about which of them were drawn.
 */

import type { FlashRateRow } from '../../db/flashRate.ts';

/**
 * The denominator at which a rate becomes drawable.
 *
 * Derived, not tuned. With one first encounter the attainable rates are 0% and 100%; with two they are
 * 0%, 50% and 100%. Below three a rate cannot land *near* the reference rule without sitting exactly on
 * it, so its position relative to that rule carries no information — while a fill drawn to that position
 * asserts one.
 *
 * The failure this prevents is concrete: one soft 7b, flashed, is `1/1` and therefore the longest bar on
 * the screen at the hardest grade on it, and length is read before the counts beside it — more so
 * one-handed in a dim gym. Since the metric exists to locate the ~50% crossing and thin cells cluster
 * exactly where that crossing sits, the noise would land on top of the reading rather than beside it.
 */
export const MIN_ENCOUNTERS = 3;

/**
 * Whether this row's denominator supports drawing a bar at all.
 *
 * Note what this does *not* test: a row of `0/6` is chartable and renders an empty fill, because six
 * first encounters with no flash is a measurement. Only the sample size is in question here, never the
 * rate.
 */
export function isChartable(row: FlashRateRow): boolean {
  return row.encounters >= MIN_ENCOUNTERS;
}
