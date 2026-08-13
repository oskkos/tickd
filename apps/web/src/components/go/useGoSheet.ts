import { useCallback, useState } from 'react';
import { db } from '../../db/schema.ts';
import { annotateTick, type TickAnnotation } from '../../db/ticks.ts';
import type { Tick } from '../../db/types.ts';
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

  const dismiss = useCallback(() => {
    setOpen(undefined);
  }, []);

  const dismissIfOpenFor = useCallback((tickId: string) => {
    setOpen((current) => (current?.tick.id === tickId ? undefined : current));
  }, []);

  return { open, annotation, openForNew, openForExisting, change, dismiss, dismissIfOpenFor };
}
