/**
 * The climber's working range — what the grade grid is positioned at.
 *
 * `DESIGN.md` §5: roughly `[min − 2 … max + 2]` of the last 90 days, so the common case is
 * zero-scroll while 9c stays reachable. The grid renders the whole scale regardless; this only
 * decides where it starts.
 */

import { maxIndex, ordinalOf, type ScaleId } from '@tickd/grade-spec';
import type { TickdDatabase } from './schema.ts';
import type { Discipline } from './types.ts';

/** How far either side of your observed range to include. */
export const RANGE_PADDING = 2;

/** How far back to look. */
export const RANGE_WINDOW_DAYS = 90;

/** Index bounds within one scale, or `undefined` when there is nothing to go on. */
export interface WorkingRange {
  readonly from: number;
  readonly to: number;
}

/** `YYYY-MM-DD`, `days` before `now`. String comparison is chronological for this format. */
function cutoff(now: Date, days: number): string {
  const at = new Date(now.getTime());
  at.setDate(at.getDate() - days);
  const month = String(at.getMonth() + 1).padStart(2, '0');
  const day = String(at.getDate()).padStart(2, '0');
  return `${String(at.getFullYear())}-${month}-${day}`;
}

/**
 * The working range for one discipline on one scale.
 *
 * **Keyed on the pair, never on either alone.** A single range across scales would mix French rope
 * with Font boulder, whose indices are incomparable — the error §4.2 keeps warning about. This is the
 * compound index earning its keep outside analytics.
 *
 * **All ticks, not sends only.** A grade you have been failing on is a grade you will be back on, and
 * omitting it would position the grid below the climb you came to try.
 *
 * **Known weakness:** `min`/`max` are outlier-sensitive, so one curious go on 8a drags the anchor
 * upward for 90 days. A percentile would be robust and is not worth it for one climber in a
 * one-month trial (design decision 3).
 */
export async function workingRange(
  db: TickdDatabase,
  discipline: Discipline,
  scale: ScaleId,
  now: Date = new Date(),
): Promise<WorkingRange | undefined> {
  const since = cutoff(now, RANGE_WINDOW_DAYS);

  const ticks = await db.ticks
    .where('[discipline+grade_scale]')
    .equals([discipline, scale])
    .filter((t) => t.date_local >= since)
    .toArray();

  if (ticks.length === 0) {
    // Day one, or a discipline never climbed. The caller does not reposition — easiest-first already
    // puts the low grades at the top, which is right for someone with no history.
    return undefined;
  }

  // No cast needed: `grade_raw` and `grade_scale` are paired by the row type, so the label is already
  // known to belong to its scale. That pairing is what `TickGrade` exists for.
  const indices = ticks.map((t) => ordinalOf(t.grade_raw, t.grade_scale).index);

  return {
    from: Math.max(0, Math.min(...indices) - RANGE_PADDING),
    to: Math.min(maxIndex(scale), Math.max(...indices) + RANGE_PADDING),
  };
}
