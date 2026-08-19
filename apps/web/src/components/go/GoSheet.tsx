import { useEffect, useRef, useState } from 'react';
import { labels } from '@tickd/grade-spec';
import type { TickAnnotation } from '../../db/ticks.ts';
import { outcomeOf } from '../../db/style.ts';
import type { RopedProtection, Tick, TickOutcome } from '../../db/types.ts';
import { outcomeWord, priorLabel, protectionLabel } from '../../format/climbing.ts';
import { GradeGrid } from '../../features/logging/GradeGrid.tsx';
import { OutcomeGrid } from '../../features/logging/OutcomeGrid.tsx';
import { ProtectionGroup } from '../../features/logging/ProtectionGroup.tsx';
import { AnnotationPanel } from './AnnotationPanel.tsx';

/**
 * One go, in detail — as a sheet over the screen rather than a block below it.
 *
 * **Named for the go rather than for the annotation**, because it stopped being only the annotation
 * panel's container. It shows what was recorded and lets each part of it be corrected; the annotation
 * fields are one region inside it. `AnnotationPanel` keeps its own name, since that is still exactly
 * what it is.
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
 *
 * **All of which applies only when the sheet followed a write.** `reason` exists because both the
 * countdown and the heading were wrong the other way round: reopening a go from three weeks ago
 * announced "Logged 6a" and started a five-second clock on a form the climber had deliberately
 * opened. The countdown's whole justification is that it keeps an *interruption* of the two-tap path
 * cheap — there is no such path to protect when the sheet is what was asked for, so a clock there does
 * the opposite of its job.
 *
 * One prop rather than two, and that is deliberate: the heading and the countdown are two expressions
 * of the same fact. Given `autoClose` and a separate heading flag they could disagree, and "Logged 6a"
 * above no countdown is a stranger state than either behaviour on its own.
 */

/**
 * How long the sheet waits before closing itself, untouched.
 *
 * Long enough to read "Logged 6a" and decide you have nothing to add; short enough that it is gone
 * before you are back on the wall.
 */
export const SHEET_IDLE_MS = 5000;

/**
 * Why the sheet is open, which is the only thing the countdown and the heading depend on.
 *
 * - `logged` — it followed a write, and the climber has not asked for it.
 * - `reopened` — a go was tapped, in the recent list or in a session's detail.
 */
export type SheetReason = 'logged' | 'reopened';

/**
 * What the sheet is showing: the annotation fields, or one of the three corrections.
 *
 * The corrections sit **one tap deeper than the detail panel**, which is what keeps the two-tap logging
 * path intact — a climber with nothing to correct sees one line stating what was recorded and no control
 * they did not ask for.
 */
type SheetMode = 'detail' | 'grade' | 'protection' | 'outcome';

/**
 * The outcome in one phrase — what `OutcomeGrid` would set, said backwards.
 *
 * Both fields, because the chip opens a control that writes both. `flashed` names its own prior
 * experience, though: a flash *is* a first-go send, so adding "first go" beside it would restate the word
 * rather than add to it. The other four outcomes say nothing about what came before, so they carry it.
 */
function outcomeSummary(tick: Tick): string {
  const outcome = outcomeOf(tick);
  return outcome === 'flash'
    ? outcomeWord(outcome)
    : `${outcomeWord(outcome)} · ${priorLabel(tick.prior_experience)}`;
}

/** The way back from a correction control, for the two that have no cancel of their own. */
function BackToDetail({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="btn btn-sm btn-outline min-h-touch shrink-0 self-start px-4"
    >
      Back
    </button>
  );
}

/**
 * One recorded fact, tappable to correct it.
 *
 * `aria-pressed` marks the one whose control is open rather than the value being "on" — there is no off
 * state for a grade. It is the only honest way to say "this is what you are editing" on a toggle-shaped
 * control, and it means the open mode is announced rather than only coloured.
 *
 * **All three facts render through here, the grade included.** The grade wants its own type size, which
 * is what `className` is for — written as a second copy of this button it drifted in target size and in
 * pressed styling from the two beside it, on a row whose whole job is that every value is both visible
 * and 48px.
 */
function Fact({
  label,
  value,
  open,
  onOpen,
  className = 'text-sm',
}: {
  label: string;
  value: string;
  open: boolean;
  onOpen: () => void;
  /** Type size, and `tabular` where the value is a grade. Carries no layout of its own. */
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={`${label}, ${value}`}
      aria-pressed={open}
      onClick={onOpen}
      className={`min-h-touch rounded-box bg-base-200 px-3 aria-pressed:bg-primary aria-pressed:text-primary-content ${className}`}
    >
      {value}
    </button>
  );
}

export function GoSheet({
  tick,
  reason,
  annotation,
  onChange,
  onCorrectGrade,
  onCorrectProtection,
  onCorrectOutcome,
  onDismiss,
}: {
  tick: Tick;
  reason: SheetReason;
  annotation: TickAnnotation;
  onChange: (next: TickAnnotation) => void;
  /** A grade from the tick's own scale. `gradeOf` still checks it — the grid proves nothing by itself. */
  onCorrectGrade: (raw: string) => void;
  onCorrectProtection: (protection: RopedProtection) => void;
  /** Both halves at once. `TickOutcome` is written whole, and a control reaching only one of them would
   *  leave a go recorded as not sent when it was sent permanently wrong. */
  onCorrectOutcome: (outcome: TickOutcome) => void;
  onDismiss: () => void;
}) {
  const [mode, setMode] = useState<SheetMode>('detail');
  /**
   * Set by the first interaction inside, which retires the countdown for this tick.
   *
   * Reset by the caller keying this component on the tick id, not by an effect. Resetting state in
   * an effect triggers a cascading render and is what the lint rule objects to — remounting is both
   * cheaper and the idiomatic way to say "this is a different sheet".
   *
   * **A reopened sheet starts engaged**, which is not a trick but the literal truth: tapping a go to
   * open its detail *is* the first interaction. Saying it this way means the timer effect and the
   * countdown bar below need no second condition, so there is one place where "does this sheet close
   * itself" is decided.
   */
  const [engaged, setEngaged] = useState(reason === 'reopened');

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
            {/* The grade moved out of the heading and into the fact row below, where it is a control
                rather than prose — it used to appear here and would otherwise read twice. What is left
                is the one thing the heading is for: whether this followed a write. */}
            <p className="text-sm">
              {reason === 'logged' ? 'Logged. Anything to add?' : 'Anything to change?'}
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

          {/*
            What was recorded, and the way to correct each part of it.

            This is the line that makes the sheet the *go* sheet rather than the annotation panel's
            container. Every value is worded from `format/climbing.ts`, so a go is described the same way
            here as in the recent-ticks list and the session detail — a fourth phrasing of "toprope" is
            exactly what that module exists to prevent.
          */}
          <div aria-label="Recorded as" role="group" className="mb-3 flex flex-wrap gap-1.5">
            {/* Verbatim, and tabular — case is the only thing separating Font `6A` from French `6a`. */}
            <Fact
              label="Grade"
              value={tick.grade_raw}
              open={mode === 'grade'}
              onOpen={() => {
                setMode(mode === 'grade' ? 'detail' : 'grade');
              }}
              className="tabular text-base"
            />

            {/*
              A boulder's protection is not a control, because `protection: 'none'` *means* boulder — it
              is not a fourth way of being roped. Shown as plain text so the sheet still says what the go
              was, without offering a change that would have to cross a discipline and take the grade's
              notation with it (D17).
            */}
            {tick.protection === 'none' ? (
              <span className="min-h-touch rounded-box flex items-center px-3 text-sm opacity-60">
                {protectionLabel(tick.protection)}
              </span>
            ) : (
              <Fact
                label="Protection"
                // Through `protectionLabel` like the boulder branch above it, so the claim that every
                // value on this row is worded from `format/climbing.ts` holds for all three of them —
                // printing the stored value here would put the second phrasing one line from the first.
                value={protectionLabel(tick.protection)}
                open={mode === 'protection'}
                onOpen={() => {
                  setMode(mode === 'protection' ? 'detail' : 'protection');
                }}
              />
            )}

            <Fact
              label="Outcome"
              value={outcomeSummary(tick)}
              open={mode === 'outcome'}
              onOpen={() => {
                setMode(mode === 'outcome' ? 'detail' : 'outcome');
              }}
            />
          </div>

          {mode === 'detail' && <AnnotationPanel annotation={annotation} onChange={onChange} />}

          {mode === 'grade' && (
            /*
              **The height is load-bearing, not styling.** `GradeGrid` positions itself by writing
              `scrollTop`, which is a silent no-op when `scrollHeight` equals `clientHeight` — and inside
              the sheet's own scroller the grid would render at its natural height and never be the
              scrolling region. The grid would then open at the top of the scale rather than at the grade
              being corrected, with every guard still passing. A definite height here is what gives its
              `flex-1 min-h-0` something to shrink against.
            */
            <div className="flex h-[45vh] flex-col gap-2">
              <GradeGrid
                scale={tick.grade_scale}
                anchor={labels(tick.grade_scale).indexOf(tick.grade_raw)}
                selected={tick.grade_raw}
                onPick={(raw) => {
                  onCorrectGrade(raw);
                  setMode('detail');
                }}
              />
              <BackToDetail
                onBack={() => {
                  setMode('detail');
                }}
              />
            </div>
          )}

          {mode === 'protection' && tick.protection !== 'none' && (
            <div className="flex flex-col gap-2">
              <ProtectionGroup
                value={tick.protection}
                label="Correct protection"
                onChange={(protection) => {
                  onCorrectProtection(protection);
                  setMode('detail');
                }}
              />
              <BackToDetail
                onBack={() => {
                  setMode('detail');
                }}
              />
            </div>
          )}

          {mode === 'outcome' && (
            <OutcomeGrid
              grade={tick.grade_raw}
              cancelLabel="Back"
              onCommit={(outcome) => {
                onCorrectOutcome(outcome);
                setMode('detail');
              }}
              onCancel={() => {
                setMode('detail');
              }}
            />
          )}
        </div>
      </section>
    </>
  );
}
