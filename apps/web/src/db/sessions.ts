/**
 * Session lifecycle.
 *
 * A session is a visit: one venue, one stretch of climbing. It exists for duration and for grouping —
 * flash rate does not read it, so a lifecycle bug costs nothing measurable in Phase 0. That is worth
 * knowing before over-engineering it.
 *
 * Two ends and a backstop:
 *
 * - **Explicit start.** The venue has to come from somewhere, and choosing it is what opens the
 *   session.
 * - **Explicit end.** Produces better data than the backstop, because it captures the cooldown and the
 *   sitting-around that first-tick-to-last-tick misses. That is what earns it a button.
 * - **Lazy close.** Nobody does admin on the way out of a gym, so a session left running is the normal
 *   case rather than the exception.
 */

import type { TickdDatabase } from './schema.ts';
import { newId } from './schema.ts';
import type { Instant, LocalDate, Session } from './types.ts';

/**
 * How long a session may sit idle before a later launch closes it.
 *
 * **Idle since the last tick, deliberately not a change of local date.** Closing on `date_local ≠
 * today` fires on the one case §7.7 explicitly contemplates — logging past midnight — and would end a
 * session while the climber is still on the wall. Idle time has no such false positive and still
 * catches anything left running overnight.
 *
 * Six hours is far longer than a session with belaying and coffee, and far shorter than the gap before
 * the next visit.
 */
export const IDLE_CLOSE_MS = 6 * 60 * 60 * 1000;

/** `YYYY-MM-DD` for an instant, in the local timezone. */
export function localDateOf(at: Date): LocalDate {
  const year = at.getFullYear();
  const month = String(at.getMonth() + 1).padStart(2, '0');
  const day = String(at.getDate()).padStart(2, '0');
  return `${String(year)}-${month}-${day}`;
}

/**
 * Minutes **east** of UTC — the ISO 8601 sign, so Helsinki in winter is `+120`.
 *
 * `getTimezoneOffset()` returns the opposite sign, which is why this is a named function rather than
 * an inline expression. A silent negation misattributes ticks near midnight to the wrong local day.
 */
export function tzOffsetOf(at: Date): number {
  return -at.getTimezoneOffset();
}

/** The open session, if there is one. At most one may be open at a time. */
export async function openSession(db: TickdDatabase): Promise<Session | undefined> {
  const sessions = await db.sessions.toArray();
  return sessions.find((s) => s.ended_at === undefined);
}

/**
 * The venue of the most recent session, open or ended — what the picker preselects.
 *
 * Sorted here rather than read off an index: Phase 0 has one climber and a handful of sessions, and
 * an index that exists only to order this would be a schema change for nothing.
 */
export async function lastVenueId(db: TickdDatabase): Promise<string | undefined> {
  const sessions = await db.sessions.toArray();
  return sessions.reduce<Session | undefined>(
    (latest, s) => (latest === undefined || s.started_at > latest.started_at ? s : latest),
    undefined,
  )?.venue_id;
}

/**
 * Opens a session, or hands back the one already running.
 *
 * **Transactional, because a double tap is not hypothetical.** Two synchronous clicks on Start used
 * to produce two rows with no `ended_at`, breaking the "at most one" that `openSession` states and
 * silently relies on — `find` then picks between them in primary-key order, so the app could resume
 * the *empty* one and show "Nothing logged yet" for a session the climber had filled. Two `readwrite`
 * transactions over the same store cannot interleave, so the second call sees the first one's row.
 *
 * Returning the open session rather than throwing: at the only call site the venue is the same one,
 * a mis-tap deserves a no-op, and a throw inside a click handler has nowhere useful to go.
 */
export async function startSession(
  db: TickdDatabase,
  venueId: string,
  now: Date,
): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    const existing = await openSession(db);
    if (existing) {
      return existing;
    }
    const session: Session = {
      id: newId(),
      venue_id: venueId,
      date_local: localDateOf(now),
      started_at: now.getTime(),
    };
    await db.sessions.add(session);
    return session;
  });
}

/** What happened to a session that was closed. */
export type CloseOutcome = 'ended' | 'discarded';

/**
 * Closes a session at a given instant, discarding it if it holds no ticks.
 *
 * A session with no ticks is noise in history — there is no evidence it means anything, and an empty
 * row is worse than an absent one because it looks like a session that failed to record.
 */
export async function closeSession(
  db: TickdDatabase,
  session: Session,
  endedAt: Instant,
): Promise<CloseOutcome> {
  const tickCount = await db.ticks.where('session_id').equals(session.id).count();
  if (tickCount === 0) {
    await db.sessions.delete(session.id);
    return 'discarded';
  }
  await db.sessions.update(session.id, { ended_at: endedAt });
  return 'ended';
}

/** Ends the open session now. The explicit path — `ended_at` is the moment of ending. */
export async function endSession(
  db: TickdDatabase,
  session: Session,
  now: Date,
): Promise<CloseOutcome> {
  return closeSession(db, session, now.getTime());
}

/** What a lazy close did, so the app can say so rather than closing silently. */
export interface LazyCloseResult {
  readonly closed: boolean;
  readonly outcome?: CloseOutcome;
  readonly dateLocal?: LocalDate;
}

/**
 * Closes a session left running, if it has been idle long enough.
 *
 * **`ended_at` is the last tick's `created_at`, never the moment of this call.** Setting it to "now"
 * would reproduce the multi-day session this exists to prevent — the fallback would become the bug.
 *
 * Returns what it did. A session quietly appearing in history that the climber never ended reads like
 * the app inventing data, so the caller is expected to say something.
 */
export async function closeIfIdle(db: TickdDatabase, now: Date): Promise<LazyCloseResult> {
  const session = await openSession(db);
  if (!session) {
    return { closed: false };
  }

  const ticks = await db.ticks.where('session_id').equals(session.id).toArray();
  const lastActivity = ticks.reduce(
    (latest, t) => Math.max(latest, t.created_at),
    session.started_at,
  );

  if (now.getTime() - lastActivity < IDLE_CLOSE_MS) {
    return { closed: false };
  }

  const outcome = await closeSession(db, session, lastActivity);
  return { closed: true, outcome, dateLocal: session.date_local };
}
