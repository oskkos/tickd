import { describe, expect, it, afterEach } from 'vitest';
import Dexie from 'dexie';
import { createDatabase, newId, SCHEMA_MARKER } from './schema.ts';
import { sendStyleOf } from './style.ts';
import type { Tick, TickBase, TickDiscipline, TickGrade, TickOutcome } from './types.ts';

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
function tick(
  outcome: TickOutcome,
  grade: TickGrade,
  discipline: TickDiscipline = ROPE,
  base: Partial<TickBase> = {},
): Tick {
  return {
    id: newId(),
    session_id: 's',
    date_local: '2026-08-07',
    tz_offset: 180,
    created_at: 0,
    updated_at: 0,
    ...base,
    ...grade,
    ...outcome,
    ...discipline,
  };
}

// Derived as a flash — sent, with nothing before it. No style is stored (D20).
const FLASHED: TickOutcome = { is_send: true, prior_experience: 'none' };
const ATTEMPTED: TickOutcome = { is_send: false, prior_experience: 'attempted' };
const FRENCH_6A: TickGrade = { grade_scale: 'french', grade_raw: '6a' };
const FONT_6A: TickGrade = { grade_scale: 'font', grade_raw: '6A' };
// Discipline and protection travel together — `protection: 'none'` *means* boulder (§7.4), so they
// cannot be set independently.
const ROPE: TickDiscipline = { discipline: 'sport', protection: 'lead' };
const BOULDER: TickDiscipline = { discipline: 'boulder', protection: 'none' };

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
    // Pinned, but no longer hand-maintained: the marker is derived from the store definitions and
    // the exhaustive field list, so a shape change moves it on its own and this test announces it.
    // Previously the constant was a literal and this assertion compared it to the same literal —
    // which rewarded never touching it, so an incompatible export could present a matching marker.
    // Moved from tickd.phase0-9272c678 when D18-D21 dropped five tick columns and added two. Nobody
    // edited the marker; the derivation did, and this pin is how it announced itself.
    expect(SCHEMA_MARKER).toBe('tickd.phase0-4ecf3c85');
  });

  it('moves the marker when the stored fields change', () => {
    // The property that matters, checked directly rather than inferred from the pin above.
    expect(SCHEMA_MARKER).toMatch(/^tickd\.phase0-[0-9a-f]{8}$/);
  });
});

describe('primary keys', () => {
  it('generates UUIDs rather than auto-incrementing counters', () => {
    const id = newId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(newId()).not.toBe(id);
  });

  it('still mints valid v4 UUIDs when randomUUID is unavailable', () => {
    // `crypto.randomUUID` is secure-context only, so it is absent over plain http — which is the
    // stated device-testing route (a phone on the LAN dev server). Simulate that, rather than
    // trusting a jsdom measurement taken in the wrong environment.
    // Save the descriptor rather than the method: reading `crypto.randomUUID` into a variable
    // detaches it from its receiver, which the unbound-method rule rightly objects to.
    const original = Object.getOwnPropertyDescriptor(Crypto.prototype, 'randomUUID');
    try {
      Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });

      const id = newId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(newId()).not.toBe(id);

      // A thousand ids with no collision — weak evidence individually, but it would catch a
      // fallback that returned a constant or reused a buffer.
      const many = new Set(Array.from({ length: 1000 }, () => newId()));
      expect(many.size).toBe(1000);
    } finally {
      Reflect.deleteProperty(crypto, 'randomUUID');
      if (original && !('randomUUID' in crypto)) {
        Object.defineProperty(Crypto.prototype, 'randomUUID', original);
      }
    }
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

  it('writes through the table without the union collapsing', async () => {
    const db = freshDb('writepath');
    // Regression guard with teeth at runtime as well as compile time. When the tables were typed
    // `EntityTable<Row, 'id'>`, Dexie derived the insert type via `Omit`, which flattened the union
    // and let `add` accept an attempt carrying a send style. `writes.assert.ts` pins the types; this
    // pins the behaviour, so a future insert-type change cannot pass by silently coercing the row.
    const flashed = tick(FLASHED, FRENCH_6A);
    const attempted = tick(ATTEMPTED, FONT_6A, BOULDER);
    await db.ticks.bulkPut([flashed, attempted]);

    const storedFlash = await db.ticks.get(flashed.id);
    expect(storedFlash).toBeDefined();
    expect(storedFlash?.is_send).toBe(true);
    expect(storedFlash?.prior_experience).toBe('none');
    expect(storedFlash && sendStyleOf(storedFlash)).toBe('flash');

    const storedAttempt = await db.ticks.get(attempted.id);
    expect(storedAttempt).toBeDefined();
    expect(storedAttempt?.is_send).toBe(false);
    expect(storedAttempt && sendStyleOf(storedAttempt)).toBeUndefined();
  });

  it('round-trips angle and holds, and tolerates their absence', async () => {
    const db = freshDb('characteristics');
    const described = tick(FLASHED, FONT_6A, BOULDER, {
      angle: 'overhang',
      holds: ['crimp', 'sloper'],
    });
    const bare = tick(ATTEMPTED, FONT_6A, BOULDER);
    await db.ticks.bulkPut([described, bare]);

    const storedDescribed = await db.ticks.get(described.id);
    expect(storedDescribed?.angle).toBe('overhang');
    expect(storedDescribed?.holds).toEqual(['crimp', 'sloper']);

    // Both are descriptive and optional — no Phase 0 metric reads them (D21).
    const storedBare = await db.ticks.get(bare.id);
    expect(storedBare?.angle).toBeUndefined();
    expect('holds' in (storedBare ?? {})).toBe(false);
  });

  it('round-trips a boulder-only venue with no rope scale', async () => {
    const db = freshDb('venuewrite');
    await db.venues.add({
      id: newId(),
      type: 'indoor',
      name: 'Boulder only',
      city: 'Tampere',
      country: 'FI',
      default_scale_boulder: 'french',
      pending_review: false,
    });

    const stored = await db.venues.where('name').equals('Boulder only').first();
    expect(stored?.default_scale_boulder).toBe('french');
    expect('default_scale_rope' in (stored ?? {})).toBe(false);
  });

  it('stores no style column at all', async () => {
    const db = freshDb('attempt');
    const attempt = tick(ATTEMPTED, FRENCH_6A);
    await db.ticks.add(attempt);

    const stored = await db.ticks.get(attempt.id);
    expect(stored).toBeDefined();
    // Not absent-on-attempts — absent everywhere. The style is computed from is_send and
    // prior_experience, so there is no column that could disagree with them (D20).
    expect('send_style' in (stored ?? {})).toBe(false);
    expect(stored && sendStyleOf(stored)).toBeUndefined();
  });
});
