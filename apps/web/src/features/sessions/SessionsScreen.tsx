import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { GoPill } from '../../components/GoPill.tsx';
import { db } from '../../db/schema.ts';
import { sessionHistory, type SessionDetail } from '../../db/sessions.ts';
import { clockTime, dayLabel, formatDuration } from '../../format/time.ts';
import { groupGoes, groupLabel, protectionsUsed } from './groups.ts';

/**
 * Every visit, newest first.
 *
 * **One pill per go, never a tally.** `DESIGN.md`'s mock showed `6b ×4` chips, and this deliberately
 * does not: two goes at one grade may be a flash and a fall, and rolling them together discards the
 * distinction the outcome model exists to record — which `summary.ts` already refuses to do. A card is
 * a glance surface, so the honest version costs height: eighteen goes is about four wrapped rows, so
 * roughly two cards fit a screen where a tallied version would fit three. The list scrolls.
 *
 * **No analytic of any kind.** The mock's header read `31 · 412 ticks · 3.9 km up`; the vertical metres
 * are gone. Wall heights are seeded absent (§12 Q1) so the figure cannot be computed, volume metrics
 * belong to Phase 1, and Phase 0 ships exactly one analytic on its own screen. A session's duration and
 * tick count stay, because those are the session's own fields rather than a measurement of anything.
 */

/** A tick count that reads as English. */
function ticksLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'tick' : 'ticks'}`;
}

function SessionCard({ row, now }: { row: SessionDetail; now: Date }) {
  const { session, venue, ticks } = row;
  const running = session.ended_at === undefined;
  const groups = groupGoes(ticks);
  // One group is the normal case and needs no heading — a label that never varies is noise. The split
  // appears only when a visit spans two `(discipline, scale)` pairs, which at Salmisaari means French
  // beside Font.
  const labelled = groups.length > 1;

  return (
    <li>
      {/*
        The whole card is the target, so there is nothing to aim at. An open session goes to the
        logging screen rather than to its own detail: what you want from the session you are in is to
        carry on, and the logging screen already lists its goes with undo attached.
      */}
      <Link
        {...(running
          ? { to: '/' }
          : { to: '/sessions/$sessionId', params: { sessionId: session.id } })}
        className="rounded-box block w-full bg-base-200 px-4 py-3 text-left"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold">
            {dayLabel(session.date_local, now)} {clockTime(session.started_at)}
          </span>
          <span className="text-sm opacity-70">
            {/* An open session's duration runs to now; a closed one's from its stored timestamps and
                unqualified. A lazily closed session's `ended_at` is its last tick, so its duration
                misses the cooldown — but nothing records which path closed a session, so there is no
                honest way to mark it and no marker is invented. */}
            {formatDuration((session.ended_at ?? now.getTime()) - session.started_at)} ·{' '}
            {ticksLabel(ticks.length)}
          </span>
        </div>

        <p className="mt-0.5 text-sm opacity-70">
          {[venue?.name, ...protectionsUsed(ticks)].filter(Boolean).join(' · ')}
          {/* Said in words, not only by a dot: colour and shape are reinforcement (`DESIGN.md` §3), and
              this is the one card whose numbers are still moving. */}
          {running && <span className="text-primary"> · still running</span>}
        </p>

        {groups.map((group) => (
          <div key={`${group.discipline}:${group.scale}`} className="mt-2">
            {labelled && <p className="mb-1 text-xs uppercase opacity-50">{groupLabel(group)}</p>}
            <ul aria-label={`Goes, ${groupLabel(group)}`} className="flex flex-wrap gap-2">
              {group.ticks.map((tick) => (
                <GoPill key={tick.id} tick={tick} />
              ))}
            </ul>
          </div>
        ))}
      </Link>
    </li>
  );
}

export function SessionsScreen({ now = new Date() }: { now?: Date }) {
  const [history, setHistory] = useState<readonly SessionDetail[] | undefined>();

  useEffect(() => {
    void sessionHistory(db).then(setHistory, (error: unknown) => {
      // An empty list is a state this screen already renders. Left unhandled this was an unhandled
      // rejection and a permanently blank screen with no explanation.
      console.error('[tickd] could not read session history', error);
      setHistory([]);
    });
  }, []);

  if (history === undefined) {
    // Nothing rather than a spinner: the read is one pass over a local database, so a spinner would
    // flash for a frame and read as jank. `undefined` is distinct from `[]` precisely so the empty
    // state is not shown before the answer is known.
    return <div className="flex min-h-0 flex-1 flex-col gap-4" />;
  }

  if (history.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <h2 className="shrink-0 text-2xl">Sessions</h2>
        {/* What will appear and when, rather than an empty list — `DESIGN.md`'s rule for day one. */}
        <p className="text-sm opacity-70">
          Nothing logged yet. Every visit you log appears here, with each go and whatever you noted
          about it.
        </p>
        <Link to="/" className="btn btn-primary min-h-touch-lg mt-auto w-full text-base">
          Start a session
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="shrink-0">
        <h2 className="text-2xl">Sessions</h2>
        <p className="text-sm opacity-70">
          {history.length} {history.length === 1 ? 'session' : 'sessions'} ·{' '}
          {ticksLabel(history.reduce((total, row) => total + row.ticks.length, 0))}
        </p>
      </div>

      {/* The list is the scroller, since the cards are the only thing here that grows. */}
      <ul aria-label="Sessions" className="flex min-h-0 flex-col gap-3 overflow-y-auto">
        {history.map((row) => (
          <SessionCard key={row.session.id} row={row} now={now} />
        ))}
      </ul>
    </div>
  );
}
