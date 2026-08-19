/**
 * A run of grades inside the span that hold no first encounter, collapsed into one row.
 *
 * **Why the grades appear at all.** Listing only the grades you have met puts 6a next to 6c and makes
 * the curve read steeper than it is — the axis stops being linear in difficulty, which is the one thing
 * it has to be for the ~50% crossing to mean anything.
 *
 * **Why they collapse.** A row per unmet grade leaves the height unbounded: one curious go on 8a adds a
 * row for every grade between it and your range, which is the same outlier sensitivity `range.ts`
 * records for the grade grid's working range — handled here by bounding the render rather than by a
 * percentile. Collapsing keeps the gap visible while making its cost a single row whatever its width,
 * and nothing is lost because the row names the grades it swallowed.
 *
 * **Why this is not a rate of zero.** A grade with no first encounters has `0/0`, which is not a rate.
 * A grade with six encounters and no flashes has `0/6`, which is a measurement, and that one is a
 * `RateRow` with an empty fill. The two must not look alike: one says *you have not met this grade*, the
 * other says *you have met it six times and never flashed it*, and rendering the first as 0% would put a
 * claim about the climber's range where there is no data at all.
 *
 * Deliberately carries no track and no fill, so it cannot be mistaken for a bar of length zero.
 */

export function GapRow({ labels }: { labels: readonly string[] }) {
  // A run of one names that grade; a run of many names its ends. The `–` is an en dash: it is a range,
  // and the grade labels themselves contain `+`, so a hyphen would read as part of a grade.
  const first = labels[0] ?? '';
  const last = labels[labels.length - 1] ?? '';
  const range = labels.length === 1 ? first : `${first}–${last}`;

  // Spelled out for a reader who cannot see that the row has no bar. "none yet" is the state; the count
  // is what makes a wide gap distinguishable from a narrow one without drawing it to scale.
  const label =
    labels.length === 1
      ? `${range}, none yet`
      : `${range}, none yet, ${String(labels.length)} grades`;

  return (
    <li aria-label={label} className="flex items-center gap-2 py-1 text-xs opacity-50">
      {/* Verbatim and tabular, matching `RateRow` so the grade column stays a single straight column
          down the axis even where a row is a gap (§7.3, `DESIGN.md` §2). */}
      <span className="tabular w-[var(--fr-label-w)] shrink-0">{range}</span>
      <span aria-hidden="true" className="flex-1 border-t border-dotted border-base-content/30" />
      <span className="w-[var(--fr-counts-w)] shrink-0 text-right">
        none yet
        {labels.length > 1 && <> · {labels.length}</>}
      </span>
    </li>
  );
}
