import { describe, expect, it, afterEach } from 'vitest';
import Dexie from 'dexie';
import { labels } from '@tickd/grade-spec';
import { createDatabase, newId, type TickdDatabase } from './schema.ts';
import { workingRange } from './range.ts';
import type { Tick } from './types.ts';

const opened: TickdDatabase[] = [];
function freshDb() {
  const db = createDatabase(`range-${newId()}`);
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

const NOW = new Date(2026, 7, 8);

function frenchRope(grade: string, dateLocal = '2026-08-01', isSend = true): Tick {
  return {
    id: newId(),
    session_id: 's',
    discipline: 'sport',
    protection: 'lead',
    grade_scale: 'french',
    grade_raw: grade,
    is_send: isSend,
    prior_experience: 'none',
    date_local: dateLocal,
    tz_offset: 180,
    created_at: 0,
    updated_at: 0,
  } as Tick;
}

function fontBoulder(grade: string, dateLocal = '2026-08-01'): Tick {
  return {
    id: newId(),
    session_id: 's',
    discipline: 'boulder',
    protection: 'none',
    grade_scale: 'font',
    grade_raw: grade,
    is_send: true,
    prior_experience: 'none',
    date_local: dateLocal,
    tz_offset: 180,
    created_at: 0,
    updated_at: 0,
  } as Tick;
}

const french = labels('french');
const at = (label: string) => french.indexOf(label as (typeof french)[number]);
const font = labels('font');
const fontAt = (label: string) => font.indexOf(label as (typeof font)[number]);

describe('workingRange', () => {
  it('pads two either side of the observed grades', async () => {
    const db = freshDb();
    await db.ticks.bulkAdd([frenchRope('6a'), frenchRope('6c')]);

    const range = await workingRange(db, 'sport', 'french', NOW);

    expect(range).toEqual({ from: at('6a') - 2, to: at('6c') + 2 });
  });

  it('clamps at the ends of the scale rather than producing invalid indices', async () => {
    const db = freshDb();
    await db.ticks.bulkAdd([frenchRope('4'), frenchRope('9c')]);

    const range = await workingRange(db, 'sport', 'french', NOW);

    expect(range).toEqual({ from: 0, to: french.length - 1 });
  });

  it('ignores the other scale entirely', async () => {
    const db = freshDb();
    // Font 6A sits at a low index; French 7a at a high one. Pooling them would widen the range and
    // rank incomparable values against each other (§4.2, D17).
    await db.ticks.bulkAdd([frenchRope('7a'), fontBoulder('6A')]);

    const range = await workingRange(db, 'sport', 'french', NOW);

    expect(range).toEqual({ from: at('7a') - 2, to: at('7a') + 2 });
  });

  it('ignores the other discipline on the same scale', async () => {
    const db = freshDb();
    const frenchBoulder = {
      ...fontBoulder('6A'),
      grade_scale: 'french',
      grade_raw: '4',
    } as Tick;
    await db.ticks.bulkAdd([frenchRope('7a'), frenchBoulder]);

    const range = await workingRange(db, 'sport', 'french', NOW);

    // A French-graded boulder shares the scale but not the discipline. The key is the pair.
    expect(range?.from).toBe(at('7a') - 2);
  });

  it('counts climbs that were never sent', async () => {
    const db = freshDb();
    // The grade you are failing on is the grade you came to try. A sends-only range would position
    // the grid below it.
    await db.ticks.bulkAdd([frenchRope('6a'), frenchRope('7b', '2026-08-01', false)]);

    const range = await workingRange(db, 'sport', 'french', NOW);

    expect(range?.to).toBe(at('7b') + 2);
  });

  it('ignores ticks older than the window', async () => {
    const db = freshDb();
    await db.ticks.bulkAdd([frenchRope('6a'), frenchRope('8a', '2026-01-01')]);

    const range = await workingRange(db, 'sport', 'french', NOW);

    expect(range?.to).toBe(at('6a') + 2);
  });

  it('returns nothing on day one', async () => {
    const db = freshDb();
    await expect(workingRange(db, 'sport', 'french', NOW)).resolves.toBeUndefined();
  });

  it('reads around a row whose label its scale does not know', async () => {
    const db = freshDb();
    // A French label stored under `grade_scale: 'font'` — the row the discipline toggle used to
    // write when tapped between the two taps. `TickGrade` forbids it, but Phase 0 has no migrations,
    // so a row already on disk stays there and this is the only layer that can cope.
    await db.ticks.bulkAdd([fontBoulder('6A'), fontBoulder('7A'), fontBoulder('6a')]);

    const range = await workingRange(db, 'boulder', 'font', NOW);

    // Skipped, not thrown on. `ordinalOf` threw inside the map, rejecting the whole promise: one bad
    // tick cost that discipline its range for the next ninety days, with an unhandled rejection in
    // the console and nothing in the UI.
    expect(range).toEqual({ from: fontAt('6A') - 2, to: fontAt('7A') + 2 });
  });

  it('returns nothing when no recent row is readable at all', async () => {
    const db = freshDb();
    await db.ticks.add(fontBoulder('6a'));

    // Day one's answer, which the grid already handles — a crash is not an improvement on it.
    await expect(workingRange(db, 'boulder', 'font', NOW)).resolves.toBeUndefined();
  });

  it('is dragged by a single outlier, which is the documented weakness', async () => {
    const db = freshDb();
    await db.ticks.bulkAdd([frenchRope('6a'), frenchRope('6b'), frenchRope('8a')]);

    const range = await workingRange(db, 'sport', 'french', NOW);

    // Recorded rather than fixed: min/max are outlier-sensitive and a percentile is not worth it for
    // one climber in a one-month trial (design decision 3).
    expect(range?.to).toBe(at('8a') + 2);
  });
});
