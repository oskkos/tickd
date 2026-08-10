import { afterEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import type { FrenchLabel } from '@tickd/grade-spec';
import { createDatabase, newId, type TickdDatabase } from './schema.ts';
import { closeSession, sessionDetail, sessionHistory, startSession } from './sessions.ts';
import type { Session, Tick, Venue } from './types.ts';

const opened: TickdDatabase[] = [];
function freshDb() {
  const db = createDatabase(`history-${newId()}`);
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

function session(startedAt: number, ended?: number): Session {
  return {
    id: newId(),
    venue_id: 'v1',
    date_local: '2026-08-08',
    started_at: startedAt,
    ...(ended === undefined ? {} : { ended_at: ended }),
  };
}

/** A roped French tick. `FrenchLabel` rather than `string`, so no `as Tick` is needed to get past the
 *  grade/scale pairing — a factory that can build a mislabelled row can prove the wrong thing. */
function tick(sessionId: string, createdAt: number, grade_raw: FrenchLabel = '6a'): Tick {
  return {
    id: newId(),
    session_id: sessionId,
    discipline: 'sport',
    protection: 'lead',
    grade_scale: 'french',
    grade_raw,
    is_send: true,
    prior_experience: 'none',
    date_local: '2026-08-08',
    tz_offset: 180,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

const VENUE: Venue = {
  id: 'v1',
  type: 'indoor',
  name: 'Kiipeilyareena Salmisaari',
  city: 'Helsinki',
  country: 'FI',
  pending_review: false,
  default_scale_rope: 'french',
  default_scale_boulder: 'font',
};

describe('sessionHistory', () => {
  it('lists sessions newest first', async () => {
    const db = freshDb();
    const old = session(1000, 2000);
    const recent = session(5000, 6000);
    await db.sessions.bulkAdd([old, recent]);

    const history = await sessionHistory(db);

    expect(history.map((h) => h.session.id)).toEqual([recent.id, old.id]);
  });

  it('carries each session its own goes, oldest first', async () => {
    const db = freshDb();
    const a = session(1000, 2000);
    const b = session(5000, 6000);
    await db.sessions.bulkAdd([a, b]);
    await db.ticks.bulkAdd([
      tick(a.id, 1500, '6a'),
      tick(b.id, 5500, '7a'),
      tick(a.id, 1200, '5+'),
    ]);

    const history = await sessionHistory(db);

    // A session read as a whole is a sequence, so oldest first — unlike the recent-ticks list, which is
    // newest-first because its job is undo.
    expect(history.map((h) => h.session.id)).toEqual([b.id, a.id]);
    expect(history[1]?.ticks.map((t) => t.grade_raw)).toEqual(['5+', '6a']);
    expect(history[0]?.ticks.map((t) => t.grade_raw)).toEqual(['7a']);
  });

  it('puts the open session first even when an older row is the open one', async () => {
    const db = freshDb();
    // Unreachable through the app: `startSession` refuses to open a second session, so the open one is
    // always the most recently started. Phase 0's importer replaces the database wholesale from a JSON
    // file, though, and that file can carry any history at all — which is why the sort says "open
    // first" rather than trusting `started_at` to imply it.
    const openButOld = session(1000);
    const closedButRecent = session(9000, 9500);
    await db.sessions.bulkAdd([openButOld, closedButRecent]);

    const history = await sessionHistory(db);

    expect(history.map((h) => h.session.id)).toEqual([openButOld.id, closedButRecent.id]);
  });

  it('gives a session with no goes an empty list rather than omitting it', async () => {
    const db = freshDb();
    const empty = session(1000, 2000);
    await db.sessions.add(empty);

    const history = await sessionHistory(db);

    expect(history).toHaveLength(1);
    expect(history[0]?.ticks).toEqual([]);
  });

  it('shows nothing for a session that was discarded', async () => {
    const db = freshDb();
    await db.venues.add(VENUE);
    const started = await startSession(db, VENUE.id, new Date(1000));
    // No ticks, so closing deletes the row rather than ending it — an empty session is noise in history,
    // and an empty card would read as a session that failed to record.
    await closeSession(db, started, 2000);

    expect(await sessionHistory(db)).toEqual([]);
  });

  it('returns nothing on an empty database', async () => {
    expect(await sessionHistory(freshDb())).toEqual([]);
  });
});

describe('sessionDetail', () => {
  it('returns the session, its venue and its goes in order', async () => {
    const db = freshDb();
    await db.venues.add(VENUE);
    const s = session(1000, 3000);
    await db.sessions.add(s);
    await db.ticks.bulkAdd([tick(s.id, 2000, '6b'), tick(s.id, 1100, '6a')]);

    const detail = await sessionDetail(db, s.id);

    expect(detail?.session.id).toBe(s.id);
    expect(detail?.venue?.name).toBe('Kiipeilyareena Salmisaari');
    expect(detail?.ticks.map((t) => t.grade_raw)).toEqual(['6a', '6b']);
  });

  it("does not pick up another session's goes", async () => {
    const db = freshDb();
    const mine = session(1000, 3000);
    const theirs = session(4000, 5000);
    await db.sessions.bulkAdd([mine, theirs]);
    await db.ticks.bulkAdd([tick(mine.id, 1100), tick(theirs.id, 4100)]);

    const detail = await sessionDetail(db, mine.id);

    expect(detail?.ticks).toHaveLength(1);
  });

  it('is undefined for an id that matches nothing', async () => {
    // The id comes out of the URL, so a stale bookmark or a wiped database is ordinary rather than
    // exceptional — the screen has to be able to say so.
    expect(await sessionDetail(freshDb(), 'no-such-session')).toBeUndefined();
  });

  it('returns the session without a venue when the venue row is missing', async () => {
    const db = freshDb();
    const s = session(1000, 3000);
    await db.sessions.add(s);

    const detail = await sessionDetail(db, s.id);

    // Reachable only through an import, and the screen should still render the goes it does have.
    expect(detail?.session.id).toBe(s.id);
    expect(detail?.venue).toBeUndefined();
  });
});
