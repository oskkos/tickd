import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ScaleId } from '@tickd/grade-spec';
import { db } from '../../db/schema.ts';
import { workingRange, type WorkingRange } from '../../db/range.ts';
import { endSession, openSession, startSession } from '../../db/sessions.ts';
import {
  annotateTick,
  logTick,
  recentTicks,
  removeTick,
  type TickAnnotation,
} from '../../db/ticks.ts';
import type { Discipline, Protection, Session, Tick, TickOutcome, Venue } from '../../db/types.ts';
import { AnnotationPanel } from './AnnotationPanel.tsx';
import { disciplinesAt, protectionOnSwitch, protectionsFor } from './disciplines.ts';
import { GradeGrid } from './GradeGrid.tsx';
import { OutcomeGrid } from './OutcomeGrid.tsx';
import { RecentTicks } from './RecentTicks.tsx';
import { VenuePicker } from './VenuePicker.tsx';

/**
 * The logging flow: pick a venue, log ticks, end the session.
 *
 * The whole screen exists to serve two taps — a grade, then an outcome — with everything else off
 * that path. `protection` is sticky and visible; annotation happens after the write; undo is a
 * persistent list rather than a toast.
 *
 * State lives here rather than in a store because Phase 0 has one screen and no router. When a second
 * screen arrives, this is the thing to extract.
 */
export function LoggingScreen() {
  const [venues, setVenues] = useState<readonly Venue[]>([]);
  const [session, setSession] = useState<Session | undefined>();
  const [selectedVenueId, setSelectedVenueId] = useState<string | undefined>();
  const [ticks, setTicks] = useState<readonly Tick[]>([]);

  const [preferred, setPreferred] = useState<Discipline>('sport');
  const [ropedProtection, setRopedProtection] = useState<Protection>('lead');
  const [range, setRange] = useState<WorkingRange | undefined>();

  const [pendingGrade, setPendingGrade] = useState<string | undefined>();
  const [justLogged, setJustLogged] = useState<Tick | undefined>();
  const [annotation, setAnnotation] = useState<TickAnnotation>({});

  useEffect(() => {
    void (async () => {
      setVenues(await db.venues.toArray());
      const open = await openSession(db);
      setSession(open);
      setSelectedVenueId((current) => open?.venue_id ?? current);
      if (open) {
        setTicks(await recentTicks(db, open.id));
      }
    })();
  }, []);

  const venue = useMemo(
    () => venues.find((v) => v.id === session?.venue_id),
    [venues, session?.venue_id],
  );
  const options = useMemo(() => (venue ? disciplinesAt(venue) : []), [venue]);

  /**
   * The discipline in force, **derived rather than stored**.
   *
   * The venue may not offer what was last preferred — Lielahti has no rope — so falling back to the
   * first option it does offer is the correction. Doing this in an effect instead meant the rope
   * protection control rendered for a frame before being corrected, which a full-suite run caught and
   * an isolated one did not. Derived state cannot have that window.
   */
  const active = options.find((o) => o.discipline === preferred) ?? options[0];
  const discipline: Discipline = active?.discipline ?? 'sport';
  const scale: ScaleId | undefined = active?.scale;
  const protection: Protection = protectionOnSwitch(discipline, ropedProtection);

  /**
   * Recomputed on mount and when the discipline changes — **not** after each tick. Repositioning
   * mid-session would move the grid under a thumb that is about to tap it.
   */
  useEffect(() => {
    if (!scale) {
      return;
    }
    void workingRange(db, discipline, scale).then(setRange);
  }, [discipline, scale]);

  const refreshTicks = useCallback(async (sessionId: string) => {
    setTicks(await recentTicks(db, sessionId));
  }, []);

  async function handleStart() {
    if (!selectedVenueId) {
      return;
    }
    const started = await startSession(db, selectedVenueId, new Date());
    setSession(started);
    setTicks([]);
  }

  async function handleEnd() {
    if (!session) {
      return;
    }
    await endSession(db, session, new Date());
    setSession(undefined);
    setTicks([]);
    setPendingGrade(undefined);
    setJustLogged(undefined);
  }

  /** The second tap. The tick is written here — there is no confirm between this and the database. */
  async function handleCommit(outcome: TickOutcome) {
    if (!session || !pendingGrade || !scale) {
      return;
    }
    const tick = await logTick(db, {
      session_id: session.id,
      discipline,
      protection,
      grade_scale: scale,
      grade_raw: pendingGrade,
      outcome,
    });
    setPendingGrade(undefined);
    setJustLogged(tick);
    setAnnotation({});
    await refreshTicks(session.id);
  }

  async function handleAnnotate(next: TickAnnotation) {
    setAnnotation(next);
    if (justLogged) {
      await annotateTick(db, justLogged.id, next);
      await refreshTicks(justLogged.session_id);
    }
  }

  async function handleRemove(id: string) {
    await removeTick(db, id);
    if (justLogged?.id === id) {
      setJustLogged(undefined);
    }
    if (session) {
      await refreshTicks(session.id);
    }
  }

  if (!session) {
    return (
      <VenuePicker
        venues={venues}
        selectedId={selectedVenueId}
        onSelect={setSelectedVenueId}
        onStart={() => void handleStart()}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-xl">{venue?.name ?? 'Session'}</h2>
          <p className="text-sm opacity-70">{ticks.length} ticks · saved locally</p>
        </div>
        <button type="button" onClick={() => void handleEnd()} className="min-h-touch text-sm">
          End session
        </button>
      </header>

      {options.length > 1 && (
        <div role="group" aria-label="Discipline" className="flex gap-2">
          {options.map((option) => (
            <button
              key={option.discipline}
              type="button"
              aria-pressed={option.discipline === discipline}
              onClick={() => {
                setPreferred(option.discipline);
              }}
              className="min-h-touch rounded-box flex-1 bg-base-200 aria-pressed:bg-primary aria-pressed:text-primary-content"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {/* Sticky, and visible — visibility is the condition DESIGN.md attaches to allowing it. */}
      {discipline !== 'boulder' && (
        <div role="group" aria-label="Protection" className="flex gap-2">
          {protectionsFor(discipline).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={p === protection}
              onClick={() => {
                setRopedProtection(p);
              }}
              className="min-h-touch rounded-box flex-1 bg-base-200 text-sm aria-pressed:bg-primary aria-pressed:text-primary-content"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {pendingGrade === undefined ? (
        scale && (
          <GradeGrid
            scale={scale}
            range={range}
            onPick={(grade) => {
              setPendingGrade(grade);
              setJustLogged(undefined);
            }}
          />
        )
      ) : (
        <OutcomeGrid grade={pendingGrade} onCommit={(outcome) => void handleCommit(outcome)} />
      )}

      {justLogged && (
        <section aria-label="Add detail" className="rounded-box bg-base-200/50 p-3">
          <p className="mb-2 text-sm opacity-70">Logged {justLogged.grade_raw}. Add detail?</p>
          <AnnotationPanel annotation={annotation} onChange={(next) => void handleAnnotate(next)} />
        </section>
      )}

      <RecentTicks ticks={ticks} onRemove={(id) => void handleRemove(id)} />
    </div>
  );
}
