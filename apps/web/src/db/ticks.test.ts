import { describe, expect, it, afterEach } from 'vitest';
import Dexie from 'dexie';
import { createDatabase, newId, type TickdDatabase } from './schema.ts';
import { annotateTick, logTick, recentTicks, removeTick, type TickDraft } from './ticks.ts';
import { sendStyleOf } from './style.ts';

const opened: TickdDatabase[] = [];
function freshDb() {
  const db = createDatabase(`ticks-${newId()}`);
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

const draft: TickDraft = {
  session_id: 'session-1',
  discipline: 'sport',
  protection: 'lead',
  grade_scale: 'french',
  grade_raw: '6c+',
  outcome: { prior_experience: 'none', is_send: true },
};

describe('logTick', () => {
  it('persists immediately, with no draft state to lose', async () => {
    const db = freshDb();
    const tick = await logTick(db, draft);

    expect(await db.ticks.get(tick.id)).toBeDefined();
  });

  it('stores no style, deriving it instead', async () => {
    const db = freshDb();
    const tick = await logTick(db, draft);

    const stored = await db.ticks.get(tick.id);
    expect('send_style' in (stored ?? {})).toBe(false);
    expect(stored && sendStyleOf(stored)).toBe('flash');
  });

  it('dates the tick by when it was logged, not by the session', async () => {
    const db = freshDb();
    // Logged at 00:15 during a session that began on Friday. A climb belongs to the local day it was
    // climbed (§7.7), so this tick is Saturday's.
    const tick = await logTick(db, draft, new Date(2026, 7, 8, 0, 15));

    expect(tick.date_local).toBe('2026-08-08');
  });

  it('records the timezone offset east of UTC', async () => {
    const db = freshDb();
    const at = new Date(2026, 7, 8, 12, 0);
    const tick = await logTick(db, draft, at);

    expect(tick.tz_offset).toBe(-at.getTimezoneOffset());
  });

  it('writes each go as its own row', async () => {
    const db = freshDb();
    // Four goes, sent on the fourth. Exactly one first encounter, so flash rate counts the climb once.
    await logTick(db, { ...draft, outcome: { prior_experience: 'none', is_send: false } });
    await logTick(db, { ...draft, outcome: { prior_experience: 'attempted', is_send: false } });
    await logTick(db, { ...draft, outcome: { prior_experience: 'attempted', is_send: false } });
    await logTick(db, { ...draft, outcome: { prior_experience: 'attempted', is_send: true } });

    const all = await db.ticks.toArray();
    expect(all).toHaveLength(4);
    expect(all.filter((t) => t.prior_experience === 'none')).toHaveLength(1);
    expect(all.filter((t) => sendStyleOf(t) === 'flash')).toHaveLength(0);
  });
});

describe('annotateTick', () => {
  it('adds detail to a tick that already exists', async () => {
    const db = freshDb();
    const tick = await logTick(db, draft);

    await annotateTick(db, tick.id, { notes: 'crux at the third clip', angle: 'overhang' });

    const stored = await db.ticks.get(tick.id);
    expect(stored?.notes).toBe('crux at the third clip');
    expect(stored?.angle).toBe('overhang');
  });

  it('leaves the outcome untouched', async () => {
    const db = freshDb();
    const tick = await logTick(db, draft);

    await annotateTick(db, tick.id, { rating: 4 });

    const stored = await db.ticks.get(tick.id);
    // Annotation only ever touches fields outside the outcome — a partial update of those would be
    // the unsound path the storage design reserves `put` for.
    expect(stored?.is_send).toBe(true);
    expect(stored?.prior_experience).toBe('none');
  });

  it('moves updated_at without moving created_at', async () => {
    const db = freshDb();
    const tick = await logTick(db, draft, new Date(1_000));

    await annotateTick(db, tick.id, { notes: 'later' }, new Date(9_000));

    const stored = await db.ticks.get(tick.id);
    expect(stored?.created_at).toBe(1_000);
    expect(stored?.updated_at).toBe(9_000);
  });
});

describe('undo', () => {
  it('removes a tick outright, with no tombstone', async () => {
    const db = freshDb();
    const tick = await logTick(db, draft);

    await removeTick(db, tick.id);

    expect(await db.ticks.get(tick.id)).toBeUndefined();
    expect(await db.ticks.count()).toBe(0);
  });

  it('still reaches a tick logged several climbs ago', async () => {
    const db = freshDb();
    const first = await logTick(db, draft, new Date(1_000));
    await logTick(db, draft, new Date(2_000));
    await logTick(db, draft, new Date(3_000));

    // A toast that vanishes in four seconds is useless when the mistake is noticed after the next
    // climb, which is why undo is a persistent list.
    const recent = await recentTicks(db, 'session-1');
    expect(recent.map((t) => t.id)).toContain(first.id);

    await removeTick(db, first.id);
    expect(await db.ticks.count()).toBe(2);
  });
});

describe('recentTicks', () => {
  it('returns the session most recent first', async () => {
    const db = freshDb();
    await logTick(db, draft, new Date(1_000));
    const newest = await logTick(db, draft, new Date(3_000));

    const recent = await recentTicks(db, 'session-1');
    expect(recent[0]?.id).toBe(newest.id);
  });

  it('does not leak other sessions', async () => {
    const db = freshDb();
    await logTick(db, draft);
    await logTick(db, { ...draft, session_id: 'session-2' });

    expect(await recentTicks(db, 'session-1')).toHaveLength(1);
  });
});
