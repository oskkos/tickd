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
   * Keyed on the scale **and the anchor index**. `scale` alone made this dead code: `range` is read
   * from Dexie and arrives a render *after* the grid mounts, so the first run found no anchor to
   * measure — `ref` is only attached to the cell at `range.from` — and the run that would have
   * found one never happened, because `scale` had not changed. The grid opened at the top of the
   * scale on every launch, which is precisely what `range.ts` exists to prevent.
   *
   * `range.from` rather than `range`, because the object is rebuilt on each load and its identity
   * would re-fire this for an unchanged position. The index changes exactly when the anchor element
   * does. Logging a tick does not recompute the range at all, so the grid still does not move under
   * a thumb that is about to tap it.
   */
  useLayoutEffect(() => {
    const container = containerRef.current;
    const anchor = anchorRef.current;
    if (!container || !anchor) {
      return;
    }
    container.scrollTop = anchor.offsetTop - container.offsetTop;
  }, [scale, range?.from]);

  const all = labels(scale);

  return (
    <div
      ref={containerRef}
      data-testid="grade-grid"
      className="grid grid-cols-3 gap-2 overflow-y-auto"
    >
      {all.map((label, index) => {
        // No range means nothing is dimmed, not that everything is. `?? Infinity` / `?? -Infinity`
        // put every cell out of range on day one, so a first-ever launch rendered all 27 buttons at
        // half opacity — which on a phone reads as "disabled", not as "no history yet", at the one
        // moment the app has to look like it works.
        const inRange = range === undefined || (index >= range.from && index <= range.to);
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
