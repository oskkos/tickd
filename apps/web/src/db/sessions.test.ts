import { describe, expect, it, afterEach } from 'vitest';
import Dexie from 'dexie';
import { createDatabase, newId, type TickdDatabase } from './schema.ts';
import {
  closeIfIdle,
  endSession,
  lastVenueId,
  localDateOf,
  openSession,
  startSession,
  tzOffsetOf,
} from './sessions.ts';
import type { Tick } from './types.ts';

const opened: TickdDatabase[] = [];
function freshDb() {
  const db = createDatabase(`sessions-${newId()}`);
  opened.push(db);
  return db;
}

afterEach(async () => {
  while (opened.length > 0) {
    const db = opened.pop();
    if (db) {
      db.close();
      await Dexie.delete(db.name);
    }
  }
});

function tickAt(sessionId: string, createdAt: number): Tick {
  return {
    id: newId(),
    session_id: sessionId,
    discipline: 'sport',
    protection: 'lead',
    grade_scale: 'french',
    grade_raw: '6a',
    is_send: true,
    prior_experience: 'none',
    date_local: '2026-08-08',
    tz_offset: 180,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

const HOUR = 60 * 60 * 1000;

describe('starting and ending', () => {
  it('opens exactly one session', async () => {
    const db = freshDb();
    const started = await startSession(db, 'venue-1', new Date(1_000_000));

    const open = await openSession(db);
    expect(open?.id).toBe(started.id);
    expect(open?.ended_at).toBeUndefined();
  });

  it('records the moment of ending, not the last tick', async () => {
    const db = freshDb();
    const session = await startSession(db, 'venue-1', new Date(0));
    await db.ticks.add(tickAt(session.id, 1 * HOUR));

    // The explicit end captures the cooldown after the last climb, which is the whole reason it is
    // better data than the lazy fallback.
    await endSession(db, session, new Date(2 * HOUR));

    const stored = await db.sessions.get(session.id);
    expect(stored?.ended_at).toBe(2 * HOUR);
  });

  it('discards a session that recorded nothing', async () => {
    const db = freshDb();
    const session = await startSession(db, 'venue-1', new Date(0));

    const outcome = await endSession(db, session, new Date(HOUR));

    expect(outcome).toBe('discarded');
    expect(await db.sessions.count()).toBe(0);
  });

  it('survives a double tap on Start', async () => {
    const db = freshDb();

    // Two clicks land before the first `await` resolves — a mis-tap on a 56px target, not an edge
    // case. This used to write two rows with no `ended_at`, so `openSession`'s "at most one" became
    // a lie and the next launch resumed whichever the primary-key order happened to yield: the
    // empty one reads "Nothing logged yet" for a session the climber had filled.
    const [first, second] = await Promise.all([
      startSession(db, 'venue-1', new Date(1_000_000)),
      startSession(db, 'venue-1', new Date(1_000_050)),
    ]);

    expect(await db.sessions.count()).toBe(1);
    expect(second.id).toBe(first.id);
  });

  it('reports the venue of the last session, ended or not', async () => {
    const db = freshDb();
    const older = await startSession(db, 'venue-1', new Date(1_000));
    await db.ticks.add(tickAt(older.id, 1_100));
    await endSession(db, older, new Date(2_000));
    const newer = await startSession(db, 'venue-2', new Date(3_000));
    await db.ticks.add(tickAt(newer.id, 3_100));
    await endSession(db, newer, new Date(4_000));

    // The picker preselects this. Reading only the *open* session left the normal path — launched
    // after ending the last one — with nothing selected and Start disabled.
    expect(await lastVenueId(db)).toBe('venue-2');
  });

  it('reports no venue before the first session', async () => {
    expect(await lastVenueId(freshDb())).toBeUndefined();
  });
});

describe('lazy close', () => {
  it('closes a session left running, at its last tick', async () => {
    const db = freshDb();
    const session = await startSession(db, 'venue-1', new Date(0));
    await db.ticks.add(tickAt(session.id, 2 * HOUR));

    // Three days later. `ended_at` must NOT be now, or the fallback reproduces the multi-day session
    // it exists to prevent.
    const result = await closeIfIdle(db, new Date(72 * HOUR));

    expect(result.closed).toBe(true);
    expect(result.outcome).toBe('ended');
    expect((await db.sessions.get(session.id))?.ended_at).toBe(2 * HOUR);
  });

  it('does not close a session that is still active', async () => {
    const db = freshDb();
    const session = await startSession(db, 'venue-1', new Date(0));
    await db.ticks.add(tickAt(session.id, 2 * HOUR));

    const result = await closeIfIdle(db, new Date(3 * HOUR));

    expect(result.closed).toBe(false);
    expect((await db.sessions.get(session.id))?.ended_at).toBeUndefined();
  });

  it('survives midnight while the climber is still on the wall', async () => {
    const db = freshDb();
    // 22:40 start, tick at 23:50, app reopened at 00:15 — a case §7.7 explicitly contemplates.
    const start = new Date(2026, 7, 7, 22, 40);
    const lastTick = new Date(2026, 7, 7, 23, 50);
    const reopen = new Date(2026, 7, 8, 0, 15);

    const session = await startSession(db, 'venue-1', start);
    await db.ticks.add(tickAt(session.id, lastTick.getTime()));

    const result = await closeIfIdle(db, reopen);

    // A date-change trigger would have closed this. Idle time is why it does not.
    expect(localDateOf(reopen)).not.toBe(session.date_local);
    expect(result.closed).toBe(false);
  });

  it('discards an idle session that never recorded anything', async () => {
    const db = freshDb();
    await startSession(db, 'venue-1', new Date(0));

    const result = await closeIfIdle(db, new Date(72 * HOUR));

    expect(result.outcome).toBe('discarded');
    expect(await db.sessions.count()).toBe(0);
  });

  it('reports what it closed, so the app can say so', async () => {
    const db = freshDb();
    const session = await startSession(db, 'venue-1', new Date(2026, 7, 4, 18, 0));
    await db.ticks.add(tickAt(session.id, new Date(2026, 7, 4, 19, 0).getTime()));

    const result = await closeIfIdle(db, new Date(2026, 7, 8, 10, 0));

    // Silent closure would look like the app inventing a session.
    expect(result.dateLocal).toBe('2026-08-04');
  });

  it('does nothing when no session is open', async () => {
    const db = freshDb();
    await expect(closeIfIdle(db, new Date())).resolves.toEqual({ closed: false });
  });
});

describe('local time helpers', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(localDateOf(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('reports minutes east of UTC, the opposite sign to getTimezoneOffset', () => {
    const at = new Date(2026, 7, 8, 12, 0);
    expect(tzOffsetOf(at)).toBe(-at.getTimezoneOffset());
  });
});
