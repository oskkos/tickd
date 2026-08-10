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
 * **Modal, reversing an earlier decision.** This used to overlay without blocking, on the grounds that
 * a modal turns every log into three interactions on a screen whose premise is two (§3). In use that
 * traded the wrong way round: a tap meant for the sheet that landed just outside it logged a *whole new
 * tick* and replaced the sheet you were filling in, so the cheap path cost you a wrong row in the
 * database and your place in the form. Blocking costs a tap; not blocking cost data.
 *
 * The countdown is what keeps the price honest — untouched, the sheet lets go by itself, so the
 * two-tap path is only interrupted when you actually reach for the details. That is also why the
 * backdrop dismisses on tap rather than merely absorbing it: the way out must be bigger than the way
 * in, and it is the whole screen.
 *
 * **It closes itself only while untouched.** The timer answers "you probably have nothing to add" and
 * nothing more — the first interaction inside retires it for good rather than restarting it. A
 * countdown that keeps chasing someone mid-form is worse than none: you would be racing a clock to
 * finish a field that was optional to begin with.
 *
 * That auto-close looks like it contradicts `DESIGN.md`'s "persistent, not a transient toast" — it
 * does not. That rule is about **undo**, where a four-second window is useless because the mistake is
 * noticed after the next climb. This is optional detail: nothing is lost when it closes, because the
 * tick is already written and the same sheet reopens from the recent list.
 */

/**
 * How long the sheet waits before closing itself, untouched.
 *
 * Long enough to read "Logged 6a" and decide you have nothing to add; short enough that it is gone
 * before you are back on the wall.
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
  /**
   * Set by the first interaction inside, which retires the countdown for this tick.
   *
   * Reset by the caller keying this component on the tick id, not by an effect. Resetting state in
   * an effect triggers a cascading render and is what the lint rule objects to — remounting is both
   * cheaper and the idiomatic way to say "this is a different sheet".
   */
  const [engaged, setEngaged] = useState(false);

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
    if (engaged) {
      return;
    }
    const timer = setTimeout(() => {
      onDismissRef.current();
    }, SHEET_IDLE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [engaged]);

  return (
    <>
      {/*
        The backdrop: what makes this modal. It covers the grid, the toggles and the recent list, so a
        near-miss tap cannot log a tick, and being `fixed` it also stops the scroll behind it — a
        touch that lands here never reaches the grade grid's scroller.

        Dimmed rather than invisible, because blocking that cannot be seen reads as the app freezing.
        Tapping it dismisses: the same gesture that would previously have logged something unwanted now
        just puts the sheet away.
      */}
      <button
        type="button"
        aria-label="Close detail"
        onClick={onDismiss}
        className="fixed inset-0 z-10 cursor-default bg-base-300/60"
      />

      <section
        aria-label={`Detail for ${tick.grade_raw}`}
        // Any interaction inside means the sheet is in use. `pointerdown` and `keydown` between them
        // cover tapping, clicking and typing — including a tap that lands on padding rather than a
        // control, because reaching for it counts as using it.
        onPointerDown={() => {
          setEngaged(true);
        }}
        onKeyDown={() => {
          setEngaged(true);
        }}
        className="rounded-box fixed inset-x-3 bottom-3 z-20 overflow-hidden bg-base-300 shadow-xl"
      >
        {/*
        The countdown, so the close is predictable rather than sudden — a sheet that vanishes without
        warning reads as a glitch, and one you can see draining tells you whether to hurry or ignore
        it.

        It disappears once the sheet is engaged, because there is nothing left to count down to.
        A frozen bar would suggest a timer merely paused, which would be a different promise.

        The duration comes from the same constant that drives the timeout, so the bar cannot drift
        from the behaviour it depicts. Hidden from assistive tech: it conveys nothing a screen reader
        can act on, and "Done" covers the same ground without relying on sight.
      */}
        {!engaged && (
          <div
            aria-hidden="true"
            style={{ animationDuration: `${String(SHEET_IDLE_MS)}ms` }}
            className="h-1 origin-left bg-primary [animation-name:sheet-countdown] [animation-timing-function:linear]"
            data-testid="sheet-countdown"
          />
        )}

        {/* Everything fits on a normal phone now that the labels are inline; the cap and scroll remain
          only as a floor for very short viewports. */}
        <div className="max-h-[80vh] overflow-y-auto p-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <p className="text-sm">
              {/* Verbatim — case separates Font from French. */}
              Logged <span className="tabular text-base">{tick.grade_raw}</span>. Add detail?
            </p>
            {/* Was underlined text, which reads as prose rather than a control — chalky hands need to
              see a target, not infer one. */}
            <button
              type="button"
              onClick={onDismiss}
              className="btn btn-sm btn-outline min-h-touch shrink-0 px-4"
            >
              Done
            </button>
          </div>

          <AnnotationPanel annotation={annotation} onChange={onChange} />
        </div>
      </section>
    </>
  );
}
