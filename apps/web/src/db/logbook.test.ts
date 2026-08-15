import { afterEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import type { FrenchLabel } from '@tickd/grade-spec';
import { createDatabase, newId, type TickdDatabase } from './schema.ts';
import { deleteLogbook, readLogbook, replaceLogbook } from './logbook.ts';
import { seedVenues, SEED_VENUES } from './seed.ts';
import type { Session, Tick, Venue } from './types.ts';

const opened: TickdDatabase[] = [];
function freshDb() {
  const db = createDatabase(`logbook-${newId()}`);
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

const VENUE: Venue = {
  id: 'v1',
  type: 'indoor',
  name: 'Kiipeilyareena Salmisaari',
  city: 'Helsinki',
  country: 'FI',
  default_scale_rope: 'french',
  default_scale_boulder: 'font',
  pending_review: false,
};

function session(id: string, startedAt: number): Session {
  return { id, venue_id: VENUE.id, date_local: '2026-08-08', started_at: startedAt };
}

function tick(id: string, sessionId: string, grade_raw: FrenchLabel = '6a'): Tick {
  return {
    id,
    session_id: sessionId,
    discipline: 'sport',
    protection: 'lead',
    grade_scale: 'french',
    grade_raw,
    is_send: true,
    prior_experience: 'none',
    date_local: '2026-08-08',
    tz_offset: 180,
    created_at: 1_000,
    updated_at: 1_000,
  };
}

async function populate(db: TickdDatabase) {
  await db.venues.put(VENUE);
  await db.sessions.put(session('s1', 1_000));
  await db.ticks.bulkPut([tick('t1', 's1'), tick('t2', 's1', '6b')]);
}

describe('readLogbook', () => {
  it('reads every table', async () => {
    const db = freshDb();
    await populate(db);

    const payload = await readLogbook(db);

    expect(payload.venues).toHaveLength(1);
    expect(payload.sessions).toHaveLength(1);
    expect(payload.ticks).toHaveLength(2);
  });
});

describe('replaceLogbook', () => {
  it('leaves exactly the supplied rows in all three tables', async () => {
    const db = freshDb();
    await populate(db);

    await replaceLogbook(db, {
      venues: [{ ...VENUE, id: 'v2', name: 'Tampereen Kiipeilykeskus Nekala' }],
      sessions: [session('s9', 5_000)],
      ticks: [tick('t9', 's9')],
    });

    expect(await db.venues.toArray()).toHaveLength(1);
    expect(await db.venues.get('v2')).toBeDefined();
    expect((await db.sessions.toArray()).map((s) => s.id)).toEqual(['s9']);
    expect((await db.ticks.toArray()).map((t) => t.id)).toEqual(['t9']);
  });

  it('removes rows the payload does not contain', async () => {
    // The distinguishing property against a merge: replacing is a restore, not a sync (§7.6).
    const db = freshDb();
    await populate(db);

    await replaceLogbook(db, { venues: [VENUE], sessions: [], ticks: [] });

    expect(await db.sessions.get('s1')).toBeUndefined();
    expect(await db.ticks.get('t1')).toBeUndefined();
  });

  it('writes identifiers and timestamps verbatim', async () => {
    // A restore, not a re-log: nothing here may re-stamp a tick into the day it was imported.
    const db = freshDb();
    const restored: Tick = {
      ...tick('t-keep', 's-keep'),
      date_local: '2026-07-04',
      tz_offset: 120,
      created_at: 42,
      updated_at: 43,
    };

    await replaceLogbook(db, {
      venues: [VENUE],
      sessions: [session('s-keep', 7)],
      ticks: [restored],
    });

    expect(await db.ticks.get('t-keep')).toEqual(restored);
    expect((await db.sessions.get('s-keep'))?.started_at).toBe(7);
  });

  it('leaves the previous logbook intact when the write fails part-way', async () => {
    const db = freshDb();
    await populate(db);

    // A row with no primary key cannot be stored. It is cast because the type system is what
    // normally prevents this — the point of the test is the rollback, not the row.
    const unstorable = { ...tick('', 's9'), id: undefined } as unknown as Tick;

    await expect(
      replaceLogbook(db, {
        venues: [VENUE],
        sessions: [session('s9', 5_000)],
        ticks: [unstorable],
      }),
    ).rejects.toThrow();

    // Everything the clear removed is back, including the tables that had already been written.
    expect(await db.sessions.get('s1')).toBeDefined();
    expect(await db.sessions.get('s9')).toBeUndefined();
    expect((await db.ticks.toArray()).map((t) => t.id).sort()).toEqual(['t1', 't2']);
    expect(await db.venues.get('v1')).toBeDefined();
  });
});

describe('deleteLogbook', () => {
  it('empties all three tables', async () => {
    const db = freshDb();
    await populate(db);

    await deleteLogbook(db);

    expect(await db.venues.count()).toBe(0);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.ticks.count()).toBe(0);
  });

  it('leaves a database that seeding makes usable again', async () => {
    // Deleting the venues is only safe because the next launch puts them back. That is the whole
    // argument for deletion having the same reach as export, so it is asserted rather than assumed.
    const db = freshDb();
    await populate(db);

    await deleteLogbook(db);
    await seedVenues(db);

    expect(await db.venues.count()).toBe(SEED_VENUES.length);
  });
});
