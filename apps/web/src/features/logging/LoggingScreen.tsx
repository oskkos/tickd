import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ScaleId } from '@tickd/grade-spec';
import { db } from '../../db/schema.ts';
import { workingRange, type WorkingRange } from '../../db/range.ts';
import { endSession, lastVenueId, openSession, startSession } from '../../db/sessions.ts';
import { gradeOf, logTick, recentTicks, removeTick } from '../../db/ticks.ts';
import type {
  Discipline,
  RopedProtection,
  Session,
  Tick,
  TickGrade,
  TickOutcome,
  Venue,
} from '../../db/types.ts';
import { AnnotationSheet } from '../../components/annotation/AnnotationSheet.tsx';
import { useAnnotation } from '../../components/annotation/useAnnotation.ts';
import { climbOn, disciplinesAt } from './disciplines.ts';
import { GradeGrid } from './GradeGrid.tsx';
import { OutcomeGrid } from './OutcomeGrid.tsx';
import { ProtectionGroup } from './ProtectionGroup.tsx';
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
  const [ropedProtection, setRopedProtection] = useState<RopedProtection>('lead');
  const [range, setRange] = useState<WorkingRange | undefined>();
  /** In-flight guard for Start: two taps used to open two sessions. */
  const [starting, setStarting] = useState(false);

  /** Set when End session is tapped: the summary is the confirmation, not a separate dialog. */
  const [ending, setEnding] = useState<Date | undefined>();
  /**
   * The first tap, **carrying the scale it was read off** rather than a bare label.
   *
   * A `string` here meant the commit paired the label with whatever scale was current at the *second*
   * tap. Switching discipline in between therefore wrote a French `6a` under `grade_scale: 'font'` —
   * a notation Font has no such grade in, unrepairable in a phase with no migrations, and enough to
   * make every later `workingRange` read of that discipline throw. Found by review.
   */
  const [pendingGrade, setPendingGrade] = useState<TickGrade | undefined>();

  useEffect(() => {
    void (async () => {
      setVenues(await db.venues.toArray());
      const open = await openSession(db);
      setSession(open);
      // The last venue, not merely the open one. Seeding this from `open` alone left the normal path
      // — launched to start a new session, previous one ended — with nothing selected, Start
      // disabled, and the picker's own "the one that's selected" pointing at nothing.
      const last = open?.venue_id ?? (await lastVenueId(db));
      setSelectedVenueId((current) => current ?? last);
      if (open) {
        const logged = await recentTicks(db, open.id);
        setTicks(logged);
        /**
         * **Discipline and protection are seeded from the session's own last go.**
         *
         * They were component state and nothing more, which the router turned into a data bug: this
         * screen unmounts on every tab navigation, so a tap on Sessions and back silently reset the
         * toggle to `sport`/`lead`. At Nekala, where both disciplines are graded in French, the grid
         * renders identical labels either way — so the next go was written as a lead route with nothing
         * on screen to contradict it, corrupting the `(discipline, grade_scale)` key every metric groups
         * by, with no repair path in a phase that has no delete and no outcome editing.
         *
         * Reading it back from the newest tick is better than merely hoisting the state somewhere that
         * survives: it also survives a reload and a crash, which the old version never did. The database
         * is already the authority on what this session has been, so nothing else needs to remember.
         */
        const latest = logged[0];
        if (latest) {
          setPreferred(latest.discipline);
          if (latest.protection !== 'none') {
            setRopedProtection(latest.protection);
          }
        }
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
  /** Discipline and protection as one value — the pair the row type requires, never two fields. */
  const climb = climbOn(discipline, ropedProtection);

  /**
   * Recomputed on mount and when the discipline changes — **not** after each tick. Repositioning
   * mid-session would move the grid under a thumb that is about to tap it.
   */
  useEffect(() => {
    if (!scale) {
      return;
    }
    void workingRange(db, discipline, scale).then(setRange, (error: unknown) => {
      // No range is a state the grid already handles — day one looks exactly like this. Left
      // unhandled it was an unhandled rejection in the console and a grid that silently stopped
      // positioning for that discipline.
      console.error('[tickd] could not compute the working range', error);
      setRange(undefined);
    });
  }, [discipline, scale]);

  const refreshTicks = useCallback(async (sessionId: string) => {
    setTicks(await recentTicks(db, sessionId));
  }, []);

  /** The detail sheet's state, shared in shape with the session detail screen but never in value. */
  const sheet = useAnnotation(
    useCallback(
      async (tick: Tick) => {
        await refreshTicks(tick.session_id);
      },
      [refreshTicks],
    ),
  );

  async function handleStart() {
    if (!selectedVenueId || starting) {
      return;
    }
    setStarting(true);
    try {
      const started = await startSession(db, selectedVenueId, new Date());
      setSession(started);
      setTicks(await recentTicks(db, started.id));
    } finally {
      setStarting(false);
    }
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
    sheet.dismiss();
  }

  /** The second tap. The tick is written here — there is no confirm between this and the database. */
  async function handleCommit(outcome: TickOutcome) {
    if (!session || !pendingGrade) {
      return;
    }
    // Both halves of the row arrive already paired — `pendingGrade` carries the scale it was picked
    // on, `climb` carries the protection its discipline implies. Nothing here can put the wrong two
    // together, because neither pair is ever apart.
    const tick = await logTick(db, {
      session_id: session.id,
      ...climb,
      ...pendingGrade,
      outcome,
    });
    setPendingGrade(undefined);
    sheet.openForNew(tick);
    await refreshTicks(session.id);
  }

  async function handleRemove(id: string) {
    await removeTick(db, id);
    sheet.dismissIfOpenFor(id);
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
    // `min-h-0` so the grade grid inside can shrink below its content and actually scroll. Everything
    // except the grid is `shrink-0`: the toggles and the End button are the fixed frame, and the grid
    // is the one region that gives.
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex shrink-0 items-baseline justify-between gap-2">
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
            sheet.dismiss();
          }}
          className="btn btn-sm btn-outline min-h-touch shrink-0 px-4"
        >
          End session
        </button>
      </header>

      {/*
        Absent while a grade is pending, not merely inert. The two taps are one transaction and the
        discipline is not part of it — leaving the toggle live let a tap between them commit the
        pending grade against the *other* discipline's scale. The grid is already swapped for the
        outcome cells at this point, so the screen visibly changes mode either way, and "Change
        grade" is the way back out.
      */}
      {options.length > 1 && pendingGrade === undefined && (
        <div role="group" aria-label="Discipline" className="flex shrink-0 gap-2">
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

      {/* Sticky, and visible — visibility is the condition DESIGN.md attaches to allowing it. Still
          live mid-pending, unlike the discipline: realising it was toprope is a correction to the go
          you are logging, and `protection` travels with the discipline it is paired to regardless.

          The buttons themselves are shared with the go sheet, which corrects this field on a written
          tick. When to show them is still this screen's decision. */}
      {climb.protection !== 'none' && (
        <ProtectionGroup value={climb.protection} onChange={setRopedProtection} />
      )}

      {pendingGrade === undefined ? (
        scale && (
          <GradeGrid
            scale={scale}
            range={range}
            onPick={(label) => {
              // Paired here, at the tap, against the scale the grid was rendered from. `undefined`
              // is unreachable — the grid renders this scale's own labels — so it is a guard rather
              // than a case: silently dropping the tap beats writing a grade in a notation it was
              // never graded with.
              const picked = gradeOf(label, scale);
              if (!picked) {
                return;
              }
              setPendingGrade(picked);
              // Picking the next grade dismisses the sheet — the whole point of it not being modal.
              sheet.dismiss();
            }}
          />
        )
      ) : (
        <OutcomeGrid
          grade={pendingGrade.grade_raw}
          onCommit={(outcome) => void handleCommit(outcome)}
          onCancel={() => {
            setPendingGrade(undefined);
          }}
        />
      )}

      <RecentTicks
        ticks={ticks}
        onRemove={(id) => void handleRemove(id)}
        onAnnotate={sheet.openForExisting}
      />

      {/* Last, and fixed — it overlays rather than sitting below the fold where nobody saw it. */}
      {sheet.open && (
        <AnnotationSheet
          // Keyed on the tick **and the reason**. The tick alone was not enough: going from
          // `{tick: A, logged}` to `{tick: A, reopened}` never passes through `undefined`, so the key was
          // unchanged, the component did not remount, and `engaged` stayed `false` from the first mount —
          // leaving the original five-second timer running under a deliberately opened form. Reachable
          // by keyboard, since the backdrop traps no focus: log a go, Tab to its row, press Enter.
          key={`${sheet.open.tick.id}:${sheet.open.reason}`}
          tick={sheet.open.tick}
          reason={sheet.open.reason}
          annotation={sheet.annotation}
          onChange={(next) => void sheet.change(next)}
          onDismiss={sheet.dismiss}
        />
      )}
    </div>
  );
}
