import type { FlashRateRow } from '../../db/flashRate.ts';
import { isChartable } from './chartable.ts';
import { ROW_COLUMNS } from './columns.ts';

/**
 * One grade's flash rate, as a row: the grade, a bar, and the counts it was computed from.
 *
 * **The track is a fixed width, and that is load-bearing.** Because every row's track spans the same
 * distance, one x-position means 50% for the whole chart — which is what lets `RateChart` draw a single
 * vertical rule and lets the reader find the crossing by scanning for the row whose fill stops reaching
 * it. `CONCEPT.md` §4.2's claim is that *the grade where your flash rate crosses ~50% is your real
 * level*, so the rule is the reading gesture rather than decoration.
 *
 * The alternative was close enough to be worth recording: scale each track's *length* to its
 * denominator and its fill to the numerator, so `1/1` is a one-unit stub and small samples limit
 * themselves with no threshold, no colour trick and no statistics. It loses because every row would
 * then be a different length, so no single x-position means 50%, the rule cannot be drawn at all, and
 * the reader is left comparing fill *fractions* across differently-sized bars. It removes the
 * overstatement by removing the thing the screen is for (design.md, D26).
 *
 * **Three states, and the middle one is the subtle one.** A rate is drawn only when its denominator
 * reaches `MIN_ENCOUNTERS`; below that the row keeps its counts and loses its fill (D26). Separately,
 * `0/6` is a *measurement* — six first encounters, none flashed — and renders as a present-but-empty
 * fill, which must not look like a grade never met. A grade never met is not a row at all; it lives
 * inside a `GapRow`, because `0/0` is not a rate.
 *
 * None of the three is distinguished by colour. `DESIGN.md` §3 forbids colour as the only signal twice
 * over — once for accessibility and once because in a gym colour already means *circuit* — so the
 * signals here are the fill's presence, the track's border treatment, and words.
 */

/**
 * The three column classes are interpolated from `columns.ts` rather than written out, because the ~50%
 * rule is drawn by re-running this row's own layout in an overlay: `gap-2` spelled here and `gap-2`
 * spelled there is two definitions of one rectangle, and the rule drifting off the fills reads as bars
 * crossing 50% at the wrong grade rather than as anything broken.
 */

/**
 * How a row names itself to a reader who cannot see the bar.
 *
 * The grade comes first because the grade is what is being scanned for, and the counts are spelled out
 * rather than left as `1/1` — a screen reader saying "one slash one" is worse than the words. The
 * suppressed state is said in the name too, since the missing fill is exactly what a non-visual reader
 * cannot observe.
 */
function rowLabel(row: FlashRateRow): string {
  const counts = `${String(row.flashes)} of ${String(row.encounters)} flashed`;
  return isChartable(row) ? `${row.label}, ${counts}` : `${row.label}, ${counts}, too few to chart`;
}

export function RateRow({ row }: { row: FlashRateRow }) {
  const chartable = isChartable(row);
  // Integer percent. A fractional width would be invisible and would make the rendered value harder to
  // assert on than the counts it comes from.
  const percent = chartable ? Math.round((row.flashes / row.encounters) * 100) : 0;

  return (
    <li aria-label={rowLabel(row)} className={`flex items-center ${ROW_COLUMNS.gap} py-1`}>
      {/*
        Verbatim, and in tabular figures. Case is the only thing separating Font `6A` from French `6a`
        (§7.3, `DESIGN.md` §2), and a proportional numeral would make the column jitter as grades change
        down the axis — which is the one column a reader's eye travels straight down.
      */}
      <span className={`tabular ${ROW_COLUMNS.label} text-sm`}>{row.label}</span>

      {/*
        The track. `data-chartable` exposes the suppression decision to the tests; the styles below take
        the same `chartable` local through a ternary rather than reading the attribute. Both are reads of
        one variable and so cannot disagree — but the attribute is not what couples them, which is what an
        earlier version of this comment claimed.
      */}
      <span
        aria-hidden="true"
        data-chartable={chartable}
        className={
          chartable
            ? 'h-3 flex-1 rounded-full bg-base-300'
            : 'h-3 flex-1 rounded-full border border-dashed border-base-content/30'
        }
      >
        {chartable && (
          <span
            data-testid="fill"
            style={{ width: `${String(percent)}%` }}
            className="block h-full rounded-full bg-primary"
          />
        )}
      </span>

      {/*
        The counts, always. §4.2 shows the rate "with its raw counts (`7a — 1/10`)" precisely so the
        reader can do what the screen declines to do for them — no crossing is computed and no headline
        grade is offered anywhere.
      */}
      <span className={`tabular ${ROW_COLUMNS.counts} text-right text-xs opacity-70`}>
        {row.flashes}/{row.encounters}
        {/* Said in words, because the absent fill is the other half of this signal and colour is not
            permitted to be either half (`DESIGN.md` §3). */}
        {!chartable && <span className="ml-1 opacity-90">too few</span>}
      </span>
    </li>
  );
}
