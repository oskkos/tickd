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
import { AnnotationSheet } from './AnnotationSheet.tsx';
import { disciplinesAt, protectionOnSwitch, protectionsFor } from './disciplines.ts';
import { GradeGrid } from './GradeGrid.tsx';
import { OutcomeGrid } from './OutcomeGrid.tsx';
import { RecentTicks } from './RecentTicks.tsx';
import { SessionSummary } from './SessionSummary.tsx';
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

  /** Set when End session is tapped: the summary is the confirmation, not a separate dialog. */
  const [ending, setEnding] = useState<Date | undefined>();
  const [pendingGrade, setPendingGrade] = useState<string | undefined>();
  /** The tick whose detail sheet is open, if any. Set by logging, and by tapping a row. */
  const [annotating, setAnnotating] = useState<Tick | undefined>();
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
    if (!session || !ending) {
      return;
    }
    // The moment End was tapped, not the moment it was confirmed — reading the summary should not
    // pad the session's duration.
    await endSession(db, session, ending);
    setSession(undefined);
    setEnding(undefined);
    setTicks([]);
    setPendingGrade(undefined);
    setAnnotating(undefined);
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
    setAnnotating(tick);
    setAnnotation({});
    await refreshTicks(session.id);
  }

  async function handleAnnotate(next: TickAnnotation) {
    setAnnotation(next);
    if (annotating) {
      // Written on every change, so the sheet closing — by timer, by Done, or by the next grade —
      // never loses anything.
      await annotateTick(db, annotating.id, next);
      await refreshTicks(annotating.session_id);
    }
  }

  /** Reopens the sheet for an earlier tick, seeded with what it already carries. */
  function handleReopen(tick: Tick) {
    setAnnotating(tick);
    setAnnotation({
      notes: tick.notes,
      angle: tick.angle,
      holds: tick.holds,
      rating: tick.rating,
      grade_opinion: tick.grade_opinion,
      length_m: tick.length_m,
    });
  }

  async function handleRemove(id: string) {
    await removeTick(db, id);
    if (annotating?.id === id) {
      setAnnotating(undefined);
    }
    if (session) {
      await refreshTicks(session.id);
    }
  }

  if (session && ending) {
    return (
      <SessionSummary
        session={session}
        venue={venue}
        ticks={ticks}
        now={ending}
        onConfirm={() => void handleEnd()}
        onCancel={() => {
          setEnding(undefined);
        }}
      />
    );
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
        {/* A real target rather than a line of text: it is rare, but it is destructive of the
            current context and should look like something you press deliberately. */}
        <button
          type="button"
          onClick={() => {
            setEnding(new Date());
            setAnnotating(undefined);
          }}
          className="btn btn-sm btn-outline min-h-touch shrink-0 px-4"
        >
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
              // Picking the next grade dismisses the sheet — the whole point of it not being modal.
              setAnnotating(undefined);
            }}
          />
        )
      ) : (
        <OutcomeGrid
          grade={pendingGrade}
          onCommit={(outcome) => void handleCommit(outcome)}
          onCancel={() => {
            setPendingGrade(undefined);
          }}
        />
      )}

      <RecentTicks
        ticks={ticks}
        onRemove={(id) => void handleRemove(id)}
        onAnnotate={handleReopen}
      />

      {/* Last, and fixed — it overlays rather than sitting below the fold where nobody saw it. */}
      {annotating && (
        <AnnotationSheet
          // Keyed on the tick, so a new one gets a fresh sheet and a fresh countdown without the
          // sheet resetting its own state in an effect.
          key={annotating.id}
          tick={annotating}
          annotation={annotation}
          onChange={(next) => void handleAnnotate(next)}
          onDismiss={() => {
            setAnnotating(undefined);
          }}
        />
      )}
    </div>
  );
}
