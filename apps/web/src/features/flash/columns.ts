/**
 * The one definition of a chart row's three columns.
 *
 * **Why this module exists, stated as the bug it prevents.** A chart row is
 * `[ grade · fixed ][ track · flex ][ counts · fixed ]`, and the ~50% reference rule is drawn by
 * *re-running that same layout* in an absolutely-positioned overlay so the line lands inside the
 * rectangle the fills are drawn in. That only holds while both sides use the same gap and the same two
 * fixed widths. Written out separately — `gap-2` in `RateRow`, `gap-2` in `GapRow`, `gap-2` in the
 * overlay — a one-token edit to any of them moves the fills and leaves the rule where it was, and the
 * result does not look broken: it looks like a chart whose bars cross 50% at a different grade than they
 * do. That is a silently wrong reading of the only number this screen exists to give.
 *
 * So the three strings live here and every consumer interpolates them. A change to the layout is then a
 * change to *all* of it by construction, and there is nothing left to drift. `RateChart.test.tsx` still
 * asserts the pairwise agreement, because a shared constant only helps while every consumer uses it —
 * the guard is against a consumer quietly spelling its own width, not against the constant changing.
 *
 * `shrink-0` travels with each fixed width rather than being added at the call site: a fixed column that
 * is allowed to shrink is not fixed, and that is the same failure by a slower route.
 */

import type { CSSProperties } from 'react';

/**
 * The gap and the two fixed column widths, as the class strings every row and the rule overlay share.
 *
 * Named rather than positional so a consumer cannot silently swap the label width for the counts width —
 * they are both `w-[…] shrink-0` and the mistake would be invisible in a diff.
 */
export const ROW_COLUMNS = {
  /** Between all three cells, on the rows and on the overlay alike. */
  gap: 'gap-2',
  /** The grade column: a `RateRow`'s label and a `GapRow`'s range share it, so the axis has one left edge. */
  label: 'w-[var(--fr-label-w)] shrink-0',
  /** The counts column: `flashes/encounters`, plus the suppressed row's short word. */
  counts: 'w-[var(--fr-counts-w)] shrink-0',
} as const;

/**
 * The two widths themselves, scoped by the chart's container because a row is never rendered outside one.
 *
 * Custom properties rather than literal Tailwind widths so that the rows and the rule demonstrably read
 * **one** pair of numbers — the same coupling `ROW_COLUMNS` protects, one level down in CSS. Undefined,
 * every row's grade column and counts column collapse to nothing, which is why the chart sets them.
 *
 * The sizes: the label column holds a `GapRow`'s widest range (`7a+–7c+`, seven characters at `text-xs`)
 * rather than a grade's three, since both share the column and a straight left edge is what makes the
 * axis an axis. The counts column holds the widest text either state can produce, which is **not**
 * `10/22 too few` as this comment first claimed: `too few` renders only below three first encounters, so a
 * suppressed row's counts can never exceed `2/2`. The genuine maxima are `2/2 too few` and a chartable
 * row's own counts, both measured as fitting on one line — wrapping either would make the shortest sample
 * the tallest row.
 *
 * jsdom measures every width as zero, so whether these two numbers are actually big enough is settled on
 * a real device at 412×600 and nowhere else.
 */
export const COLUMN_WIDTHS = {
  '--fr-label-w': '3.25rem',
  '--fr-counts-w': '4.75rem',
} as CSSProperties;
