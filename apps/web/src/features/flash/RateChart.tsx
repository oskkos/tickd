import type { ReactNode } from 'react';
import type { FlashRateGroup } from '../../db/flashRate.ts';
import { COLUMN_WIDTHS, ROW_COLUMNS } from './columns.ts';
import { collapseGaps } from './gaps.ts';
import { GapRow } from './GapRow.tsx';
import { chartLabel } from './labels.ts';
import { RateRow } from './RateRow.tsx';

/**
 * One `(protection, discipline, scale)` group, drawn as an axis of rows against a ~50% rule.
 *
 * **Ordinary DOM, no charting dependency (D25).** At most twenty-seven categorical rows: a track is a
 * `div` with a background, a fill is a nested `div` with a percentage width, and the reference rule is one
 * absolutely-positioned element per chart. Recharts is ~100 KB gzipped and the service worker precaches
 * the bundle before first use, so install weight is paid up front; uPlot is ~15 KB but canvas, which would
 * make the grade labels painted pixels and this the one Phase 0 surface the suite cannot query and a
 * screen reader cannot read. `DESIGN.md` §6 already reached this conclusion about the grade grid.
 *
 * **The rule is one element for the whole chart, not one per row, and that is the point of the fixed
 * track.** Because every row's track spans the same distance, a single x-position means 50% down the
 * entire chart, so the reader finds the crossing by scanning for the row whose fill stops reaching the
 * line. `CONCEPT.md` §4.2's claim is that *the grade where your flash rate crosses ~50% is your real
 * level*, and the rule is that reading gesture made available. A per-row marker would draw the same
 * geometry n times and permit n different answers to where 50% is.
 *
 * **Nothing here computes the crossing.** No level, no limit grade, no headline. §4.2 puts the crossing on
 * the reader precisely because the sample sizes are thin, and a headline would state a conclusion with
 * more confidence than the data supports. The mock this screen comes from *did* carry one — "You cross 50%
 * at 6b+" — and it is gone on purpose; it is the well-meant addition a later reader would otherwise make.
 *
 * A line and a label, never a colour change: `DESIGN.md` §3 forbids colour as the only signal twice over,
 * once for accessibility and once because in a gym colour already means *circuit*.
 */

/**
 * The row layout with an empty label cell and an empty counts cell, so a caller can put something in the
 * track column and have it land over the fills.
 *
 * **This mirrors the row rather than restating it as insets**, which is the difference between "the rule
 * is at 50% of the track" being true by construction and being true until someone changes a gap. The
 * classes are not merely *the same as* `RateRow`'s — they are literally the same strings, out of
 * `columns.ts`, so the middle cell here cannot stop being the rectangle the fills are drawn in without
 * the fills moving with it. `RateChart.test.tsx` asserts the agreement anyway, since a shared constant
 * only helps while every consumer still interpolates it.
 */
function TrackColumn({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div className={`flex items-center ${ROW_COLUMNS.gap} ${className}`}>
      <span aria-hidden="true" className={ROW_COLUMNS.label} />
      <span className="relative flex-1 self-stretch">{children}</span>
      <span aria-hidden="true" className={ROW_COLUMNS.counts} />
    </div>
  );
}

export function RateChart({ group }: { group: FlashRateGroup }) {
  const label = chartLabel(group);
  const items = collapseGaps(group.rows);

  return (
    <section className="shrink-0" style={COLUMN_WIDTHS}>
      {/*
        Always rendered, including when this is the only chart — the deliberate divergence from
        `SessionsScreen`'s `labelled = groups.length > 1`. See `chartLabel`: there the pills sit inside a
        visit that supplies the context, here the grade column *is* the axis and nothing else in the frame
        tells Font `6A` from French `6a`. `uppercase` is safe on these words and would not be one line
        down (§7.3, `DESIGN.md` §2).
      */}
      <h3 className="mb-1 text-xs uppercase opacity-50">{label}</h3>

      {/* The rule's label, in normal flow above the rows so it reserves its own height instead of sitting
          on top of the first grade. Centred on the line because it is the same track column. */}
      <TrackColumn className="h-3">
        <span className="tabular absolute left-1/2 -translate-x-1/2 text-[0.625rem] leading-3 opacity-60">
          ~50%
        </span>
      </TrackColumn>

      <div className="relative">
        <ul aria-label={`Flash rate, ${label}`}>
          {items.map((item) =>
            item.kind === 'rate' ? (
              <RateRow key={item.row.label} row={item.row} />
            ) : (
              // Keyed on the grade the run starts at, which is unique within a chart: a scale's labels
              // appear once each in the span, so no two runs can begin at the same grade.
              <GapRow key={`gap:${item.labels[0] ?? ''}`} labels={item.labels} />
            ),
          )}
        </ul>

        {/*
          The rule itself: one element, spanning every row, at 50% of the track column. After the list in
          document order so it paints over the fills rather than under them — the bar is read as crossing
          the line, which is the gesture, and a rule hidden behind a long fill would be missing at exactly
          the rows that matter.

          `aria-hidden` because a vertical line is geometry; the `~50%` above says the same thing in text,
          and every row already announces its own counts.
        */}
        <TrackColumn className="pointer-events-none absolute inset-0">
          <span
            aria-hidden="true"
            data-testid="rule"
            className="absolute inset-y-0 left-1/2 w-px bg-base-content/40"
          />
        </TrackColumn>
      </div>
    </section>
  );
}
