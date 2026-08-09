import { useEffect, useRef, useState } from 'react';
import type { TickAnnotation } from '../../db/ticks.ts';
import type { Tick } from '../../db/types.ts';
import { AnnotationPanel } from './AnnotationPanel.tsx';

/**
 * The detail panel, as a sheet over the screen rather than a block below it.
 *
 * It used to render in flow after the grade grid, which on a phone put it below the fold — present in
 * the DOM, invisible in the hand. Optional detail that nobody can see is the same as no detail.
 *
 * **Not modal.** A modal would block the next grade tap, turning every log into three interactions on
 * a screen whose entire premise is two (§3). This overlays without trapping focus: tap a grade behind
 * it and logging continues.
 *
 * **It fades on inactivity**, which looks like it contradicts `DESIGN.md`'s "persistent, not a
 * transient toast" — it does not. That rule is about **undo**, where a four-second window is useless
 * because the mistake is noticed after the next climb. This is optional detail: nothing is lost when
 * it closes, because the tick is already written and the same sheet reopens from the recent list.
 *
 * The timer restarts on any interaction inside, so it never closes under someone who is using it.
 */

/**
 * How long the sheet waits before closing itself.
 *
 * Long enough to read "Logged 6a" and decide you have nothing to add; short enough that it is gone
 * before you are back on the wall. Every interaction resets it.
 */
export const SHEET_IDLE_MS = 5000;

export function AnnotationSheet({
  tick,
  annotation,
  onChange,
  onDismiss,
}: {
  tick: Tick;
  annotation: TickAnnotation;
  onChange: (next: TickAnnotation) => void;
  onDismiss: () => void;
}) {
  // Bumped on every interaction, which restarts the timer below.
  const [activity, setActivity] = useState(0);
  /**
   * The latest `onDismiss`, held in a ref so the timer below does not depend on it.
   *
   * The parent passes a fresh closure every render, so depending on it directly would restart the
   * countdown on any unrelated re-render — the sheet would effectively never close. Written in an
   * effect rather than during render, which is the rule this originally broke.
   */
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismissRef.current();
    }, SHEET_IDLE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [activity, tick.id]);

  return (
    <section
      aria-label={`Detail for ${tick.grade_raw}`}
      // Interaction anywhere inside keeps it open — including typing, which `onChange` alone would
      // not catch until the value actually changed.
      onPointerDown={() => {
        setActivity((n) => n + 1);
      }}
      onKeyDown={() => {
        setActivity((n) => n + 1);
      }}
      className="rounded-box fixed inset-x-3 bottom-3 z-20 bg-base-300 p-4 shadow-xl"
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="text-sm">
          {/* Verbatim — case separates Font from French. */}
          Logged <span className="tabular text-base">{tick.grade_raw}</span>. Add detail?
        </p>
        <button type="button" onClick={onDismiss} className="min-h-touch text-sm underline">
          Done
        </button>
      </div>

      <AnnotationPanel
        annotation={annotation}
        onChange={(next) => {
          setActivity((n) => n + 1);
          onChange(next);
        }}
      />
    </section>
  );
}
