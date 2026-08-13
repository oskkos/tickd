import { describe, expect, it, afterEach } from 'vitest';
import Dexie from 'dexie';
import { createDatabase, newId, type TickdDatabase } from './schema.ts';
import {
  annotateTick,
  correctGrade,
  correctOutcome,
  correctProtection,
  logTick,
  recentTicks,
  removeTick,
  type TickDraft,
} from './ticks.ts';
import { sendStyleOf } from './style.ts';
import type { RopedTick, Tick } from './types.ts';

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

/**
 * The boulder counterpart, in Font — Kiipeilyareena grades boulders in Font and routes in French, which
 * is why a cross-scale correction has to be impossible rather than merely unlikely.
 */
const boulderDraft: TickDraft = {
  session_id: 'session-1',
  discipline: 'boulder',
  protection: 'none',
  grade_scale: 'font',
  grade_raw: '6A',
  outcome: { prior_experience: 'none', is_send: false },
};

/** Every annotation field at once — the six that a whole-row `put` could silently drop. */
const everything = {
  notes: 'crux at the third clip',
  angle: 'overhang',
  holds: ['crimp', 'sloper'],
  rating: 4,
  grade_opinion: 'hard',
  length_m: 18,
} as const;

/**
 * Narrows a logged tick to the roped member.
 *
 * `tick.protection === 'none'` is the whole test, and it is the same one the go sheet uses to decide
 * whether a protection control renders at all.
 */
function roped(tick: Tick): RopedTick {
  if (tick.protection === 'none') {
    throw new Error('expected a roped tick');
  }
  return tick;
}

describe('correcting a written tick', () => {
  it('re-grades within the notation the tick already carries', async () => {
    const db = freshDb();
    const tick = await logTick(db, draft);

    const corrected = await correctGrade(db, tick, '7a');

    expect(corrected?.grade_raw).toBe('7a');
    expect((await db.ticks.get(tick.id))?.grade_raw).toBe('7a');
  });

  it('changes how a roped go was protected', async () => {
    const db = freshDb();
    // The failure this exists for: `protection` is sticky, so a toprope lap logged without switching it
    // records as lead, and the mistake is noticed several goes later.
    const tick = await logTick(db, draft);

    await correctProtection(db, roped(tick), 'toprope');

    const stored = await db.ticks.get(tick.id);
    expect(stored?.protection).toBe('toprope');
    // The pair travels together: correcting the protection never moves the discipline.
    expect(stored?.discipline).toBe('sport');
  });

  it('re-records the outcome as a pair', async () => {
    const db = freshDb();
    const tick = await logTick(db, {
      ...draft,
      outcome: { prior_experience: 'attempted', is_send: false },
    });

    await correctOutcome(db, tick, { prior_experience: 'none', is_send: true });

    const stored = await db.ticks.get(tick.id);
    expect(stored?.is_send).toBe(true);
    expect(stored?.prior_experience).toBe('none');
    // Both halves moved, so the derived style follows — this is flash rate's numerator.
    expect(stored && sendStyleOf(stored)).toBe('flash');
  });

  it('leaves the go where it is in time and in the session', async () => {
    const db = freshDb();
    // Logged on the Tuesday, corrected on the Thursday. A climb belongs to the local day it was
    // climbed, so nothing here may move it (§7.7).
    const tick = await logTick(db, draft, new Date(2026, 7, 11, 18, 42));

    const corrected = await correctGrade(db, tick, '7a', new Date(2026, 7, 13, 9, 0));

    expect(corrected?.id).toBe(tick.id);
    expect(corrected?.session_id).toBe(tick.session_id);
    expect(corrected?.created_at).toBe(tick.created_at);
    expect(corrected?.date_local).toBe('2026-08-11');
    expect(corrected?.tz_offset).toBe(tick.tz_offset);
    expect(await db.ticks.count()).toBe(1);
  });

  it('records the correction as a modification', async () => {
    const db = freshDb();
    const tick = await logTick(db, draft, new Date(1_000));

    await correctGrade(db, tick, '7a', new Date(9_000));

    const stored = await db.ticks.get(tick.id);
    expect(stored?.created_at).toBe(1_000);
    expect(stored?.updated_at).toBe(9_000);
  });

  /**
   * The highest-consequence failure in the correction path, and a silent one.
   *
   * These write the whole row through `put`, so any field not carried across is not stale but *gone* —
   * and `notes` has no other copy.
   */
  it.each([
    ['grade', (db: TickdDatabase, tick: Tick) => correctGrade(db, tick, '7a')],
    [
      'protection',
      (db: TickdDatabase, tick: Tick) => correctProtection(db, roped(tick), 'toprope'),
    ],
    [
      'outcome',
      (db: TickdDatabase, tick: Tick) =>
        correctOutcome(db, tick, { prior_experience: 'sent', is_send: true }),
    ],
  ])('carries every annotation across a %s correction', async (_field, correct) => {
    const db = freshDb();
    const tick = await logTick(db, draft);
    await annotateTick(db, tick.id, everything);

    await correct(db, tick);

    const stored = await db.ticks.get(tick.id);
    expect(stored).toMatchObject(everything);
  });

  /**
   * The reason each correction re-reads inside a transaction rather than writing the caller's copy.
   *
   * `AnnotationPanel` writes through `annotateTick` once per keystroke while the sheet is open, so the
   * row the sheet was opened with goes stale within a word. A `put` built from it would erase the note.
   */
  it('writes the row as it is now, not as the caller last saw it', async () => {
    const db = freshDb();
    const stale = await logTick(db, draft);
    await annotateTick(db, stale.id, { notes: 'typed after the sheet opened' });

    await correctGrade(db, stale, '7a');

    const stored = await db.ticks.get(stale.id);
    expect(stored?.notes).toBe('typed after the sheet opened');
    expect(stored?.grade_raw).toBe('7a');
  });

  it('refuses a label from the other notation, writing nothing', async () => {
    const db = freshDb();
    const tick = await logTick(db, boulderDraft);

    // Font `6A` and French `6a` differ only by letter case, so this would record a different climb.
    const corrected = await correctGrade(db, tick, '6a');

    expect(corrected).toBeUndefined();
    const stored = await db.ticks.get(tick.id);
    expect(stored?.grade_scale).toBe('font');
    expect(stored?.grade_raw).toBe('6A');
  });

  it('refuses a protection correction on a boulder, writing nothing', async () => {
    const db = freshDb();
    const tick = await logTick(db, boulderDraft);

    // The cast is the point: `correctProtection` takes a `RopedTick`, so this is a compile error at any
    // real call site. What is under test is the guard on the row it actually reads — the last line of
    // defence if a future caller finds a way past the type.
    const corrected = await correctProtection(db, tick as unknown as RopedTick, 'lead');

    expect(corrected).toBeUndefined();
    expect((await db.ticks.get(tick.id))?.protection).toBe('none');
  });

  it('refuses when the row is gone', async () => {
    const db = freshDb();
    const tick = await logTick(db, draft);
    await removeTick(db, tick.id);

    expect(await correctGrade(db, tick, '7a')).toBeUndefined();
    expect(
      await correctOutcome(db, tick, { prior_experience: 'sent', is_send: true }),
    ).toBeUndefined();
    expect(await db.ticks.count()).toBe(0);
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
