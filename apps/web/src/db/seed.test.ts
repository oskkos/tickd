import { describe, expect, it, afterEach } from 'vitest';
import Dexie from 'dexie';
import { createDatabase, newId, type TickdDatabase } from './schema.ts';
import { SEED_VENUES, seedVenues } from './seed.ts';

/** A fresh database per test. A shared one would let the idempotence test pass for the wrong
 *  reason — it would be asserting that seeding happened once, not that it converges. */
const opened: TickdDatabase[] = [];
function freshDb() {
  const db = createDatabase(`seed-${newId()}`);
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

describe('seeding', () => {
  it('inserts every venue into an empty database', async () => {
    const db = freshDb();
    await seedVenues(db);

    const names = (await db.venues.toArray()).map((v) => v.name).sort();
    expect(names).toEqual([
      'Kiipeilyareena Ristikko',
      'Kiipeilyareena Salmisaari',
      'Tampereen Kiipeilykeskus Lielahti',
      'Tampereen Kiipeilykeskus Nekala',
    ]);
  });

  it('converges rather than duplicating when run repeatedly', async () => {
    const db = freshDb();
    await seedVenues(db);
    await seedVenues(db);
    await seedVenues(db);

    // Hardcoded ids are what make this true. Generated ids would append the whole list per launch.
    expect(await db.venues.count()).toBe(SEED_VENUES.length);
  });

  it('uses literal identifiers, not generated ones', () => {
    // This asserts the literals directly, and the reason is worth recording. The obvious test —
    // seed twice and compare ids — cannot fail: a module-level `crypto.randomUUID()` is evaluated
    // once per process, so it is stable within a test run and only differs between browser launches,
    // which a single process cannot observe. That test was written, passed against a deliberately
    // generated id, and was replaced by this one.
    //
    // A generated id would re-seed a fourth venue on every launch, and every tick written before it
    // would point at a venue row that no longer exists.
    expect(SEED_VENUES.map((v) => v.id)).toEqual([
      '2f8a1c40-0000-4000-8000-000000000001',
      '2f8a1c40-0000-4000-8000-000000000002',
      '2f8a1c40-0000-4000-8000-000000000003',
      '2f8a1c40-0000-4000-8000-000000000004',
    ]);
  });

  it('converges when the same ids are written by a second caller', async () => {
    const db = freshDb();
    await seedVenues(db);
    // Proves `bulkPut` semantics rather than `bulkAdd`, which would reject the existing keys.
    await db.venues.bulkPut([...SEED_VENUES]);

    expect(await db.venues.count()).toBe(SEED_VENUES.length);
  });
});

describe('scales across the seed set', () => {
  it('grades boulders differently at different venues', async () => {
    const db = freshDb();
    await seedVenues(db);

    const byName = new Map((await db.venues.toArray()).map((v) => [v.name, v]));

    // The point of the seed set, not an inconsistency: one discipline spans two scales (D17).
    expect(byName.get('Kiipeilyareena Salmisaari')?.default_scale_boulder).toBe('font');
    expect(byName.get('Kiipeilyareena Ristikko')?.default_scale_boulder).toBe('font');
    expect(byName.get('Tampereen Kiipeilykeskus Nekala')?.default_scale_boulder).toBe('french');
    expect(byName.get('Tampereen Kiipeilykeskus Lielahti')?.default_scale_boulder).toBe('french');
  });

  it('grades rope in French wherever rope exists', async () => {
    const db = freshDb();
    await seedVenues(db);

    const scales = (await db.venues.toArray())
      .map((v) => v.default_scale_rope)
      .filter((s) => s !== undefined);
    expect(new Set(scales)).toEqual(new Set(['french']));
  });

  it('gives a boulder-only venue no rope scale at all', async () => {
    const db = freshDb();
    await seedVenues(db);

    // Lielahti has no ropes. Absent rather than a scale nobody can use — a missing scale means the
    // discipline is not offered here, which is what the logging screen reads to hide rope entirely.
    const lielahti = await db.venues
      .where('name')
      .equals('Tampereen Kiipeilykeskus Lielahti')
      .first();
    expect(lielahti?.default_scale_rope).toBeUndefined();
    expect(lielahti?.default_scale_boulder).toBe('french');

    // Every other seeded venue does offer rope, so the absence above is specific rather than a
    // seeding bug that dropped the field everywhere.
    const others = (await db.venues.toArray()).filter((v) => v.id !== lielahti?.id);
    expect(others.every((v) => v.default_scale_rope === 'french')).toBe(true);
  });

  it('lets one scale serve both disciplines', async () => {
    const db = freshDb();
    await seedVenues(db);

    // Tampere grades rope AND boulder in French. A scale identifies a notation, never a discipline,
    // so nothing may treat 'font' as "the boulder scale".
    const tampere = await db.venues.where('name').equals('Tampereen Kiipeilykeskus Nekala').first();
    expect(tampere?.default_scale_rope).toBe('french');
    expect(tampere?.default_scale_boulder).toBe('french');
  });
});

describe('venue metadata', () => {
  it('models locations rather than brands', async () => {
    const db = freshDb();
    await seedVenues(db);

    const areena = await db.venues.where('brand').equals('Kiipeilyareena').toArray();
    // Two rows, not one — the sites have different walls and heights (§7.5).
    expect(areena).toHaveLength(2);
    expect(new Set(areena.map((v) => v.id)).size).toBe(2);

    // Both brands have two locations, and at Tampere they are not even interchangeable: one has
    // ropes and the other does not. That is the strongest case for venue-as-location.
    const tampere = await db.venues.where('brand').equals('Tampereen Kiipeilykeskus').toArray();
    expect(tampere).toHaveLength(2);
    expect(tampere.filter((v) => v.default_scale_rope !== undefined)).toHaveLength(1);
  });

  it('leaves wall height absent rather than guessing it', async () => {
    const db = freshDb();
    await seedVenues(db);

    for (const venue of await db.venues.toArray()) {
      // CONCEPT.md §12 Q1 is still open. A guessed height would skew vertical metres silently.
      expect(venue.default_route_length_m).toBeUndefined();
    }
  });

  it('marks seed venues as reviewed, since only user submissions are pending', async () => {
    const db = freshDb();
    await seedVenues(db);

    for (const venue of await db.venues.toArray()) {
      expect(venue.pending_review).toBe(false);
    }
  });
});
