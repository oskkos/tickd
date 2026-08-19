/**
 * Turning a group's contiguous span into the rows a chart actually draws.
 *
 * `flashRate.ts` returns every grade between the easiest and the hardest one holding a first encounter,
 * including the ones holding none, and says why: the elision is a rendering concern, and a renderer that
 * wants to collapse a run needs the run present to count it. This is that renderer's half.
 *
 * **A presentation module, like `chartable.ts`, and outside `db/` for the same reason.** Nothing here
 * changes a count. The span stays the span; only how many `<li>`s it costs changes.
 */

import type { FlashRateRow } from '../../db/flashRate.ts';

/**
 * A rate row, or a run of grades nobody has met yet.
 *
 * Discriminated rather than "a row with an optional label list", so a chart cannot render a gap's
 * `encounters` — there is no such field to reach for. `0/0` is not a rate and must never be drawn as one.
 */
export type ChartItem =
  | { readonly kind: 'rate'; readonly row: FlashRateRow }
  | { readonly kind: 'gap'; readonly labels: readonly string[] };

/**
 * Collapses every run of consecutive zero-encounter grades into one gap item, whatever its length.
 *
 * **There is no threshold, and that is the answer rather than a shortcut.** design.md left open whether
 * the boundary should be two or three — whether a run of one unmet grade should render as itself. The
 * question dissolves on inspection: a grade with no first encounters has `0/0`, which is not a rate, so
 * it can never be a `RateRow` in the first place. The choice was never *gap row versus rate row*, it was
 * *gap row versus a differently-shaped gap row*, and `GapRow` already names a run of one as that single
 * grade (`6b · none yet`). A threshold would therefore buy a second rendering of the same fact.
 *
 * **Do not add one.** A reader arriving at `labels.length === 1` may well feel a one-grade gap deserves
 * a plainer row; the cost is that the axis then has two kinds of not-yet-climbed row, and the one that
 * looks like a rate row is exactly the confusion `GapRow` and `RateRow`'s empty-fill state were split to
 * prevent — `0/0` reading as a measured 0%.
 *
 * The span's ends are observed by construction (`flashRate.ts`), so no gap can appear first or last. This
 * function does not rely on that; it would simply emit a leading gap if given one, since refusing to
 * would be a claim about the data enforced in the wrong module.
 */
export function collapseGaps(rows: readonly FlashRateRow[]): readonly ChartItem[] {
  const items: ChartItem[] = [];
  let run: string[] = [];

  const flush = () => {
    if (run.length > 0) {
      items.push({ kind: 'gap', labels: run });
      run = [];
    }
  };

  for (const row of rows) {
    if (row.encounters === 0) {
      run.push(row.label);
      continue;
    }
    flush();
    items.push({ kind: 'rate', row });
  }
  flush();

  return items;
}
