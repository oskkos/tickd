import { describe, expect, it, afterEach } from 'vitest';
import Dexie from 'dexie';
import { createDatabase, newId, SCHEMA_MARKER } from './schema.ts';
import type { Tick, TickBase, TickGrade, TickOutcome } from './types.ts';

/**
 * Every test gets its own database. A shared one would let the seed-idempotence tests pass for the
 * wrong reason, and would make index assertions depend on test order.
 */
const opened: Dexie[] = [];
function freshDb(name: string) {
  const db = createDatabase(`${name}-${newId()}`);
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

/**
 * Builds a tick from its three parts.
 *
 * Deliberately **not** `{ ...defaults, ...overrides } as Tick`. That shape was written first and was
 * wrong: overriding `is_send` to `false` left the default `send_style: 'flash'` in place, and the
 * cast silenced the very invariant this module exists to enforce. Taking the grade and outcome as
 * whole typed values means a partial override cannot produce an invalid combination, and no cast is
 * needed.
 */
function tick(outcome: TickOutcome, grade: TickGrade, base: Partial<TickBase> = {}): Tick {
  return {
    id: newId(),
    session_id: 's',
    venue_id: 'v',
    discipline: 'sport',
    protection: 'lead',
    tags: [],
    date_local: '2026-08-07',
    tz_offset: 180,
    created_at: 0,
    updated_at: 0,
    ...base,
    ...grade,
    ...outcome,
  };
}

const FLASHED: TickOutcome = { is_send: true, send_style: 'flash', prior_experience: 'none' };
const ATTEMPTED: TickOutcome = { is_send: false, prior_experience: 'attempted' };
const FRENCH_6A: TickGrade = { grade_scale: 'french', grade_raw: '6a' };
const FONT_6A: TickGrade = { grade_scale: 'font', grade_raw: '6A' };
const BOULDER = { discipline: 'boulder', protection: 'none' } as const satisfies Partial<TickBase>;

describe('schema versioning', () => {
  it('declares exactly one version, because Phase 0 writes no migrations', () => {
    const db = freshDb('versions');
    // Reaching for version(2) is how a Dexie migration would arrive. D7 says a Phase 0 schema change
    // wipes and restarts instead, so a second version means the rule was broken.
    expect(db.verno).toBe(1);
  });

  it('attaches no upgrade callback', () => {
    const db = freshDb('upgrade');
    // Dexie exposes no public accessor for this, so reach into `_versions` — the alternative is not
    // checking at all, and an `.upgrade()` callback is precisely the migration logic D7 forbids.
    const versions = (db as unknown as { _versions: { _cfg: { contentUpgrade?: unknown } }[] })
      ._versions;
    expect(versions).toHaveLength(1);
    for (const version of versions) {
      expect(version._cfg.contentUpgrade ?? null).toBeNull();
    }
  });

  it('exports a schema marker for the importer to compare against', () => {
    expect(SCHEMA_MARKER).toBe('tickd.phase0.v1');
  });
});

describe('primary keys', () => {
  it('generates UUIDs rather than auto-incrementing counters', () => {
    const id = newId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(newId()).not.toBe(id);
  });

  it('declares no auto-incrementing key on any store', () => {
    const db = freshDb('autoincrement');
    for (const table of db.tables) {
      expect(table.schema.primKey.auto).toBe(false);
    }
  });
});

describe('indexes', () => {
  it('carries a compound index over discipline and grade scale', () => {
    const db = freshDb('compound');
    const names = db.table('ticks').schema.indexes.map((i) => i.name);
    expect(names).toContain('[discipline+grade_scale]');
  });

  it('does not index tags, which no Phase 0 query reads', () => {
    const db = freshDb('tags');
    const names = db.table('ticks').schema.indexes.map((i) => i.name);
    expect(names).not.toContain('tags');
  });

  it('returns only ticks matching both parts of the grouping key', async () => {
    const db = freshDb('grouping');
    await db.ticks.bulkAdd([
      tick(FLASHED, FONT_6A, BOULDER),
      tick(FLASHED, FRENCH_6A, BOULDER),
      tick(FLASHED, FRENCH_6A),
    ]);

    // Grouping by discipline alone would pool the two boulders — Font 6A against French 6a, which
    // are very different climbs. Grouping by scale alone would pool the French boulder with the
    // French rope route. Only the pair is correct (§4.2, D17).
    const fontBoulders = await db.ticks
      .where('[discipline+grade_scale]')
      .equals(['boulder', 'font'])
      .toArray();
    expect(fontBoulders).toHaveLength(1);
    expect(fontBoulders[0]?.grade_raw).toBe('6A');

    const frenchBoulders = await db.ticks
      .where('[discipline+grade_scale]')
      .equals(['boulder', 'french'])
      .toArray();
    expect(frenchBoulders).toHaveLength(1);
    expect(frenchBoulders[0]?.grade_raw).toBe('6a');

    // The same discipline across two scales stays two groups — two boulder pyramids, not one (D17).
    expect(fontBoulders[0]?.id).not.toBe(frenchBoulders[0]?.id);
  });
});

describe('round trip', () => {
  it('stores and returns a tick verbatim, including grade case', async () => {
    const db = freshDb('roundtrip');
    const original = tick(FLASHED, FONT_6A, BOULDER);
    await db.ticks.add(original);

    const stored = await db.ticks.get(original.id);
    // Case is the only thing separating Font from French, so it is data rather than styling.
    expect(stored?.grade_raw).toBe('6A');
    expect(stored?.grade_scale).toBe('font');
  });

  it('keeps send_style absent on an attempt rather than storing a null', async () => {
    const db = freshDb('attempt');
    const attempt = tick(ATTEMPTED, FRENCH_6A);
    await db.ticks.add(attempt);

    const stored = await db.ticks.get(attempt.id);
    expect(stored).toBeDefined();
    // Absent, not null. Flash rate counts first encounters, so a stray send_style on an attempt
    // would inflate the numerator with a climb that was never sent (§4.2, D14).
    expect('send_style' in (stored ?? {})).toBe(false);
  });
});
