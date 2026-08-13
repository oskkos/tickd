import { useCallback, useState } from 'react';
import { db } from '../../db/schema.ts';
import {
  annotateTick,
  correctGrade,
  correctOutcome,
  correctProtection,
  type TickAnnotation,
} from '../../db/ticks.ts';
import type { RopedProtection, Tick, TickOutcome } from '../../db/types.ts';
import type { SheetReason } from './GoSheet.tsx';

/**
 * The go sheet's state, extracted so two screens can each have their own.
 *
 * `LoggingScreen` owned this and said so: "State lives here rather than in a store because Phase 0 has
 * one screen and no router. When a second screen arrives, this is the thing to extract." The session
 * detail is that second screen.
 *
 * **A hook rather than a context or a store**, because there is nothing to share. The two sheets never
 * coexist — opening a session's detail means leaving the logging route — so a single shared value would
 * be two screens taking turns writing to one slot, which is a way for one to close the other's sheet.
 */

/** Which tick's sheet is open, and why it opened. */
export interface OpenSheet {
  readonly tick: Tick;
  readonly reason: SheetReason;
}

export interface Annotation {
  /** The open sheet, or `undefined` when none is. */
  readonly open: OpenSheet | undefined;
  /** What the sheet currently holds. */
  readonly annotation: TickAnnotation;
  /** Open for a tick that has just been written — the sheet will close itself. */
  readonly openForNew: (tick: Tick) => void;
  /** Open for an existing tick, seeded with what it carries. The sheet stays put. */
  readonly openForExisting: (tick: Tick) => void;
  /** Record a change, writing it through immediately. */
  readonly change: (next: TickAnnotation) => Promise<void>;
  /** Re-grade the open tick, within the notation it already carries. */
  readonly correctGrade: (raw: string) => Promise<void>;
  /** Change how the open tick was protected. A boulder has none to change, so it is a no-op there. */
  readonly correctProtection: (protection: RopedProtection) => Promise<void>;
  /** Re-record how the go went — both halves of `TickOutcome` together. */
  readonly correctOutcome: (outcome: TickOutcome) => Promise<void>;
  readonly dismiss: () => void;
  /** Dismiss only if the open sheet is for this tick — used when a tick is removed under it. */
  readonly dismissIfOpenFor: (tickId: string) => void;
}

export function useGoSheet(afterWrite: (tick: Tick) => void | Promise<void>): Annotation {
  const [open, setOpen] = useState<OpenSheet | undefined>();
  const [annotation, setAnnotation] = useState<TickAnnotation>({});

  const openForNew = useCallback((tick: Tick) => {
    setOpen({ tick, reason: 'logged' });
    setAnnotation({});
  }, []);

  const openForExisting = useCallback((tick: Tick) => {
    setOpen({ tick, reason: 'reopened' });
    // Seeded from the row, so reopening shows what is stored rather than an empty form that would
    // overwrite it on the first keystroke.
    setAnnotation({
      notes: tick.notes,
      angle: tick.angle,
      holds: tick.holds,
      rating: tick.rating,
      grade_opinion: tick.grade_opinion,
      length_m: tick.length_m,
    });
  }, []);

  const change = useCallback(
    async (next: TickAnnotation) => {
      setAnnotation(next);
      if (!open) {
        return;
      }
      // Written on every change, so the sheet closing — by timer, by Done, by the backdrop, or by
      // navigating away — never loses anything.
      await annotateTick(db, open.tick.id, next);
      await afterWrite(open.tick);
    },
    [open, afterWrite],
  );

  /**
   * Runs a correction and **replaces the row the sheet renders from**.
   *
   * The replacement is the whole point rather than housekeeping. This hook held `open.tick` and never
   * refreshed it, which was harmless while the only field the sheet displayed — the grade in its heading —
   * could not change. The moment a grade is correctable, the same code shows the old grade above a grid
   * that has just changed it: a stale read presented as the current state.
   *
   * **`reason` is carried over deliberately.** Both callers key the sheet on `${tick.id}:${reason}`, so
   * changing it would remount the component — resetting `engaged` and restarting a countdown that had
   * been retired, under a form somebody is using. That is the bug that made the key two-part in the first
   * place. It is also why the key must never include a field a correction changes.
   */
  const applyCorrection = useCallback(
    async (write: (tick: Tick) => Promise<Tick | undefined>) => {
      if (!open) {
        return;
      }
      const written = await write(open.tick);
      if (!written) {
        // Refused, and nothing was written — a label from the other notation, or a row that is gone.
        // Leaving the sheet showing what is still stored is the honest outcome.
        return;
      }
      setOpen({ tick: written, reason: open.reason });
      await afterWrite(written);
    },
    [open, afterWrite],
  );

  const correctGradeTo = useCallback(
    async (raw: string) => {
      await applyCorrection((tick) => correctGrade(db, tick, raw));
    },
    [applyCorrection],
  );

  const correctProtectionTo = useCallback(
    async (protection: RopedProtection) => {
      await applyCorrection((tick) =>
        // `protection === 'none'` *means* boulder, and `correctProtection` takes a `RopedTick` — so this
        // narrowing is what makes the call legal rather than a guard bolted on. The sheet does not offer
        // the control for a boulder, so this branch is unreachable from the interface.
        tick.protection === 'none'
          ? Promise.resolve(undefined)
          : correctProtection(db, tick, protection),
      );
    },
    [applyCorrection],
  );

  const correctOutcomeTo = useCallback(
    async (outcome: TickOutcome) => {
      await applyCorrection((tick) => correctOutcome(db, tick, outcome));
    },
    [applyCorrection],
  );

  const dismiss = useCallback(() => {
    setOpen(undefined);
  }, []);

  const dismissIfOpenFor = useCallback((tickId: string) => {
    setOpen((current) => (current?.tick.id === tickId ? undefined : current));
  }, []);

  return {
    open,
    annotation,
    openForNew,
    openForExisting,
    change,
    correctGrade: correctGradeTo,
    correctProtection: correctProtectionTo,
    correctOutcome: correctOutcomeTo,
    dismiss,
    dismissIfOpenFor,
  };
}
