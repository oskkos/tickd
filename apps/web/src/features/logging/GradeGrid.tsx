import { useLayoutEffect, useRef } from 'react';
import { labels, type ScaleId } from '@tickd/grade-spec';
import type { WorkingRange } from '../../db/range.ts';

/**
 * The grade grid.
 *
 * **Plain `<button>`s.** `CLAUDE.md` calls this the one place a component library is actively wrong —
 * there is no behaviour to borrow, only 27 targets that must be big enough for chalky fingers.
 *
 * **The whole scale renders, easiest first.** `DESIGN.md` §5 proposed truncating to the working range
 * with a "show all" expansion; this positions instead. Rendering everything avoids a day-one fallback
 * when there is no range to truncate to, and an expansion state to reset when the scale switches —
 * and easiest-first already puts a typical range in the first few rows, so truncation buys less than
 * it appears to.
 *
 * **Grade text renders verbatim.** No `text-transform`, ever: case is the only thing separating Font
 * `6A` from French `6a`, so transforming it would redisplay every French grade as a harder Font one
 * (`DESIGN.md` §2, §7.3).
 */
export function GradeGrid({
  scale,
  range,
  onPick,
}: {
  scale: ScaleId;
  range?: WorkingRange | undefined;
  onPick: (grade: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);

  /**
   * A starting position, not a scroll.
   *
   * `useLayoutEffect` so it lands before paint — the list simply begins at the working range, like a
   * book opening at a bookmark. An animated `scrollIntoView` would read as the app fidgeting on every
   * launch.
   *
   * Keyed on `scale` alone. It must recompute when the discipline switches to a different grid, and
   * must **not** re-run after a tick is logged: repositioning mid-session would move the grid under a
   * thumb that is about to tap it.
   */
  useLayoutEffect(() => {
    const container = containerRef.current;
    const anchor = anchorRef.current;
    if (!container || !anchor) {
      return;
    }
    container.scrollTop = anchor.offsetTop - container.offsetTop;
  }, [scale]);

  const all = labels(scale);

  return (
    <div
      ref={containerRef}
      data-testid="grade-grid"
      className="grid grid-cols-3 gap-2 overflow-y-auto"
    >
      {all.map((label, index) => {
        const inRange = index >= (range?.from ?? Infinity) && index <= (range?.to ?? -Infinity);
        return (
          <button
            key={label}
            ref={index === range?.from ? anchorRef : undefined}
            type="button"
            onClick={() => {
              onPick(label);
            }}
            aria-label={`Grade ${label}`}
            data-in-range={inRange}
            className={[
              'min-h-touch rounded-box tabular flex items-center justify-center text-2xl',
              inRange ? 'bg-base-200 text-base-content' : 'bg-base-200/40 text-base-content/50',
            ].join(' ')}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
