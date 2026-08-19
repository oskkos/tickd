import { describe, expect, it, afterEach } from 'vitest';
import Dexie from 'dexie';
import { labels, type ScaleId } from '@tickd/grade-spec';
import { createDatabase, newId, type TickdDatabase } from './schema.ts';
import { byFixedOrder, flashRates, PROTECTION_ORDER, type FlashRateGroup } from './flashRate.ts';
import type { Protection, Tick } from './types.ts';

const opened: TickdDatabase[] = [];
function freshDb() {
  const db = createDatabase(`flashRate-${newId()}`);
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
 * The fields a test overrides, deliberately **unpaired**.
 *
 * `Partial<Tick>` cannot serve here. `Partial` is homomorphic, so it distributes over the two
 * discriminated unions `Tick` is built from and an override object has to satisfy one whole member —
 * which makes `{ grade_scale: 'font' }` alone a type error and `{ discipline: 'boulder' }` alone
 * another. Flattening the four fields is not a loss of rigour in a *fixture*: the pairing is enforced
 * where rows are written (`writes.assert.ts` pins that down at the tables), and this file needs to
 * seed a row the type system forbids on purpose — the unreadable-label case below is exactly a
 * French label stored under `grade_scale: 'font'`, which is the row on disk this module must survive.
 */
type TickOverride = Partial<
  Omit<Tick, 'discipline' | 'protection' | 'grade_scale' | 'grade_raw'>
> & {
  readonly discipline?: Tick['discipline'];
  readonly protection?: Protection;
  readonly grade_scale?: ScaleId;
  readonly grade_raw?: string;
};

/**
 * A tick, defaulting to a French lead flash at 6a.
 *
 * `as Tick` for the reason `range.test.ts` does it: the invariants are enforced at the write paths, and
 * a test that has to construct a row honouring them field by field stops being readable. Every call
 * below keeps `(discipline, protection)` and `(grade_scale, grade_raw)` paired by hand, except where
 * breaking the pairing is the thing under test.
 */
function tick(over: TickOverride = {}): Tick {
  return {
    id: newId(),
    session_id: 's',
    discipline: 'sport',
    protection: 'lead',
    grade_scale: 'french',
    grade_raw: '6a',
    is_send: true,
    prior_experience: 'none',
    date_local: '2026-08-01',
    tz_offset: 180,
    created_at: 0,
    updated_at: 0,
    ...over,
  } as Tick;
}

/** A French-graded roped go. */
function roped(grade: string, protection: Protection = 'lead', over: TickOverride = {}): Tick {
  return tick({ protection, grade_raw: grade, ...over });
}

/** A Font-graded boulder. `protection: 'none'` *means* boulder (§7.4), so the two travel together. */
function fontBoulder(grade: string, over: TickOverride = {}): Tick {
  return tick({
    discipline: 'boulder',
    protection: 'none',
    grade_scale: 'font',
    grade_raw: grade,
    ...over,
  });
}

/** `n` copies of a go, since the interesting denominators are all several ticks at one grade. */
function times(n: number, make: () => Tick): readonly Tick[] {
  return Array.from({ length: n }, make);
}

function only(groups: readonly FlashRateGroup[]): FlashRateGroup {
  expect(groups).toHaveLength(1);
  const group = groups[0];
  if (!group) {
    throw new Error('unreachable — asserted above');
  }
  return group;
}

function rowFor(group: FlashRateGroup, label: string) {
  return group.rows.find((row) => row.label === label);
}

const french = labels('french');

describe('flashRates — the metric', () => {
  it('counts a flash in both the numerator and the denominator', async () => {
    const db = freshDb();
    await db.ticks.add(roped('6a'));

    const group = only(await flashRates(db));

    expect(group.rows).toEqual([{ label: '6a', encounters: 1, flashes: 1 }]);
  });

  it('counts a first encounter that was never sent in the denominator', async () => {
    const db = freshDb();
    // Ten different 7a's: one flashed, nine walked away from. Dividing by sends would report 1 of 1 —
    // biased upward at exactly the limit grade the metric exists to locate (§4.2, D14).
    await db.ticks.bulkAdd([
      roped('7a'),
      ...times(9, () => roped('7a', 'lead', { is_send: false })),
    ]);

    const group = only(await flashRates(db));

    expect(rowFor(group, '7a')).toEqual({ label: '7a', encounters: 10, flashes: 1 });
  });

  it('counts an attempted or previously sent go in neither, sent or not', async () => {
    const db = freshDb();
    await db.ticks.bulkAdd([
      roped('6a'),
      roped('6b', 'lead', { prior_experience: 'attempted', is_send: true }),
      roped('6b', 'lead', { prior_experience: 'attempted', is_send: false }),
      roped('6b', 'lead', { prior_experience: 'sent', is_send: true }),
      roped('6b', 'lead', { prior_experience: 'sent', is_send: false }),
    ]);

    const group = only(await flashRates(db));

    // Not merely zero at 6b — absent from the span, because a grade held up only by repeats is not a
    // grade this metric has measured. A `0/0` row there would read as an unmet grade instead.
    expect(group.rows).toEqual([{ label: '6a', encounters: 1, flashes: 1 }]);
  });

  it('counts over the whole logbook, with no window', async () => {
    const db = freshDb();
    await db.ticks.bulkAdd([roped('6a', 'lead', { date_local: '2024-01-15' }), roped('6b')]);

    const group = only(await flashRates(db));

    // Two years back and still counted. `range.ts` sits next door windowing at 90 days and this
    // module's doc comment contrasts the two deliberately — so without an old tick in a fixture, a
    // later author copying that pattern would break the requirement with a green suite. Found by
    // review: every other fixture here is dated the same day.
    expect(group.rows[0]).toEqual({ label: '6a', encounters: 1, flashes: 1 });
    expect(rowFor(group, '6b')).toEqual({ label: '6b', encounters: 1, flashes: 1 });
  });

  it('reports counts and never a rate', async () => {
    const db = freshDb();
    await db.ticks.bulkAdd([
      roped('6a'),
      ...times(3, () => roped('6a', 'lead', { is_send: false })),
    ]);

    const group = only(await flashRates(db));

    // 1 of 4 is 25%, and the shape carries neither the percentage nor the suppression the renderer
    // derives from `encounters`. A stored rate would be computable from its two neighbours and
    // therefore able to disagree with them (§7.3, D20).
    expect(Object.keys(group.rows[0] ?? {}).sort()).toEqual(['encounters', 'flashes', 'label']);
  });
});

describe('flashRates — the key', () => {
  it('keeps Font boulders and French boulders in separate groups', async () => {
    const db = freshDb();
    // The seeded reality: Font at the Kiipeilyareena sites, French at Tampere (D17). Font `6A` and
    // French `6a` differ only in letter case and mean very different difficulties, so one group would
    // be a ranking of incomparable values rather than an error.
    await db.ticks.bulkAdd([
      ...times(3, () => fontBoulder('6A')),
      ...times(2, () => tick({ discipline: 'boulder', protection: 'none', grade_raw: '6a' })),
    ]);

    const groups = await flashRates(db);

    expect(groups.map((g) => g.scale)).toEqual(['font', 'french']);
    expect(groups.every((g) => g.discipline === 'boulder' && g.protection === 'none')).toBe(true);
    expect(groups.map((g) => g.rows)).toEqual([
      [{ label: '6A', encounters: 3, flashes: 3 }],
      [{ label: '6a', encounters: 2, flashes: 2 }],
    ]);
  });

  it('keeps rope and boulder apart when both are graded French', async () => {
    const db = freshDb();
    // Tampereen Kiipeilykeskus Nekala grades both disciplines in French, so a shared notation does not
    // make a boulder comparable to a route (D17). `TickDiscipline` correlates discipline with
    // protection — boulder is always `none` — so this asserts that the reported key carries both
    // halves, not that discipline alone is what splits them.
    await db.ticks.bulkAdd([
      roped('6a'),
      tick({ discipline: 'boulder', protection: 'none', grade_raw: '6a' }),
    ]);

    const groups = await flashRates(db);

    expect(groups.map((g) => [g.discipline, g.scale, g.protection])).toEqual([
      ['sport', 'french', 'lead'],
      ['boulder', 'french', 'none'],
    ]);
  });

  it('computes each protection from its own ticks alone', async () => {
    const db = freshDb();
    // Both at 6b. Pooled, the grade would read 3 of 5 — a toprope flash raising the lead curve exactly
    // where the crossing is read.
    await db.ticks.bulkAdd([
      ...times(2, () => roped('6b', 'lead')),
      roped('6b', 'toprope'),
      ...times(2, () => roped('6b', 'toprope', { is_send: false })),
    ]);

    const groups = await flashRates(db);

    expect(groups.map((g) => [g.protection, g.rows])).toEqual([
      ['lead', [{ label: '6b', encounters: 2, flashes: 2 }]],
      ['toprope', [{ label: '6b', encounters: 3, flashes: 1 }]],
    ]);
  });

  it('gives boulder a group with no special-casing', async () => {
    const db = freshDb();
    await db.ticks.add(fontBoulder('7A'));

    const group = only(await flashRates(db));

    // `protection: 'none'` falls out of the same key everything else uses. Naming it *boulder* is the
    // renderer's job (`groups.ts:64`), so nothing here translates it.
    expect(group).toEqual({
      discipline: 'boulder',
      scale: 'font',
      protection: 'none',
      rows: [{ label: '7A', encounters: 1, flashes: 1 }],
    });
  });

  it('reports groups in a fixed order rather than the order they were logged', async () => {
    const db = freshDb();
    // Logged boulder-first, deliberately. A session card would read back boulder-first and should
    // (`groupGoes`); a reference screen returned to between climbs must not reorder itself because of
    // how last night started.
    await db.ticks.bulkAdd([
      fontBoulder('6A'),
      roped('6a', 'autobelay'),
      roped('6a', 'toprope'),
      roped('6a', 'lead'),
    ]);

    const groups = await flashRates(db);

    expect(groups.map((g) => g.protection)).toEqual(PROTECTION_ORDER);
  });

  it('yields nothing at all on an empty logbook', async () => {
    const db = freshDb();
    await expect(flashRates(db)).resolves.toEqual([]);
  });

  it('yields nothing at all for a logbook of only repeats', async () => {
    const db = freshDb();
    // The all-repeats case one layer up from the per-protection one below: with no first encounter
    // anywhere, there is nothing to chart at all and the screen shows prose. `[]` originates here, so
    // it is pinned here rather than only through a group that happens to sit beside a lead group.
    await db.ticks.bulkAdd([
      roped('6a', 'lead', { prior_experience: 'sent' }),
      roped('6b', 'toprope', { prior_experience: 'attempted', is_send: false }),
      fontBoulder('6A', { prior_experience: 'sent' }),
    ]);

    await expect(flashRates(db)).resolves.toEqual([]);
  });

  it('orders scales within one protection, which insertion order cannot contradict', async () => {
    const db = freshDb();
    // Logged in reverse of the reported order throughout.
    await db.ticks.bulkAdd([
      tick({ discipline: 'boulder', protection: 'none', grade_raw: '6a' }),
      fontBoulder('6A'),
      roped('6a', 'autobelay'),
      roped('6a', 'toprope'),
      roped('6a', 'lead'),
    ]);

    const groups = await flashRates(db);

    expect(groups.map((g) => [g.protection, g.scale, g.discipline])).toEqual([
      ['lead', 'french', 'sport'],
      ['toprope', 'french', 'sport'],
      ['autobelay', 'french', 'sport'],
      ['none', 'font', 'boulder'],
      ['none', 'french', 'boulder'],
    ]);
    // This pins the protection term end to end, and it is as far as a fixture reaches: the two boulder
    // groups come back Font-then-French whether or not the comparator says so, because the compound
    // index yields keys discipline-ascending then scale-ascending and `'font' < 'french'`. See
    // `byFixedOrder`'s own suite below for the terms no data can exercise.
  });
});

describe('flashRates — the span', () => {
  it('runs contiguously from the easiest to the hardest grade with a first encounter', async () => {
    const db = freshDb();
    await db.ticks.bulkAdd([roped('6a'), roped('7a')]);

    const group = only(await flashRates(db));

    // Every grade between, so the renderer can collapse the run into one gap row and the curve is not
    // drawn steeper than it is by putting 6a next to 7a.
    expect(group.rows.map((r) => r.label)).toEqual(
      french.slice(french.indexOf('6a'), french.indexOf('7a') + 1),
    );
  });

  it('carries interior unmet grades as zero rows rather than omitting them', async () => {
    const db = freshDb();
    await db.ticks.bulkAdd([roped('6a'), roped('6b')]);

    const group = only(await flashRates(db));

    // `0/0` is not a rate and must never be drawn as 0% — but the run has to be present to be
    // counted, which is what the gap row's range label is built from.
    expect(rowFor(group, '6a+')).toEqual({ label: '6a+', encounters: 0, flashes: 0 });
    expect(rowFor(group, '6b')).toEqual({ label: '6b', encounters: 1, flashes: 1 });
  });

  it('carries a met grade with no flashes as a real zero, beside a genuine gap', async () => {
    const db = freshDb();
    await db.ticks.bulkAdd([
      roped('6a'),
      ...times(4, () => roped('6c', 'lead', { is_send: false })),
    ]);

    const group = only(await flashRates(db));

    // `0/4` is a measurement — four different 6c's, none flashed — and `0/0` at 6b is the absence of
    // one. The requirement is that the two do not look alike, which they cannot do if only one of them
    // survives to the renderer. Found by review: no other fixture here has a met grade without a
    // flash, so deleting every real-zero row left the suite green.
    expect(rowFor(group, '6c')).toEqual({ label: '6c', encounters: 4, flashes: 0 });
    expect(rowFor(group, '6b')).toEqual({ label: '6b', encounters: 0, flashes: 0 });
    expect(rowFor(group, '6a')).toEqual({ label: '6a', encounters: 1, flashes: 1 });
  });

  it('bounds the span by first encounters, not by ticks', async () => {
    const db = freshDb();
    // An 8a repeat sits above the range. It is not a measurement this metric makes, so it must not
    // stretch the axis — or the chart would show sixteen unmet grades above the climber's real range.
    await db.ticks.bulkAdd([
      roped('6a'),
      roped('6b'),
      roped('8a', 'lead', { prior_experience: 'sent' }),
    ]);

    const group = only(await flashRates(db));

    expect(group.rows[0]?.label).toBe('6a');
    expect(group.rows.at(-1)?.label).toBe('6b');
  });

  it('gives a protection climbed entirely as repeats no group at all', async () => {
    const db = freshDb();
    // Membership is *has a first encounter*, not *has ticks*. A toprope pane built from these rows
    // would be empty, which is why the selector's condition is the stronger one.
    await db.ticks.bulkAdd([
      roped('6a', 'lead'),
      roped('6b', 'toprope', { prior_experience: 'sent' }),
      roped('6c', 'toprope', { prior_experience: 'attempted', is_send: false }),
    ]);

    const groups = await flashRates(db);

    expect(groups.map((g) => g.protection)).toEqual(['lead']);
  });
});

describe('flashRates — rows this build cannot make sense of', () => {
  it('skips a grade its scale cannot read, from the counts and from the span, without rejecting', async () => {
    const db = freshDb();
    // A French label stored under `grade_scale: 'font'` — the row the discipline toggle used to write
    // when tapped between the two taps. `TickGrade` forbids it, but Phase 0 has no migrations, so a row
    // already on disk stays there and this layer is the only one that can cope. `range.ts:68` records
    // what `ordinalOf` cost there: one such row inside a `.map` rejected the whole promise and left a
    // discipline with no working range for ninety days.
    await db.ticks.bulkAdd([fontBoulder('6A'), fontBoulder('6B'), fontBoulder('6a')]);

    const group = only(await flashRates(db));

    expect(group.rows).toEqual([
      { label: '6A', encounters: 1, flashes: 1 },
      { label: '6A+', encounters: 0, flashes: 0 },
      { label: '6B', encounters: 1, flashes: 1 },
    ]);
    // Not present as an unmet grade either. Dropping the row from the counts alone would let it
    // reappear as a `0/0` gap — the same false claim in quieter form.
    expect(rowFor(group, '6a')).toBeUndefined();
  });

  it('yields no group when every row of a pair is unreadable', async () => {
    const db = freshDb();
    await db.ticks.add(fontBoulder('6a'));

    // The empty-logbook answer, which the screen already handles as prose. A crash is not an
    // improvement on it.
    await expect(flashRates(db)).resolves.toEqual([]);
  });

  it('skips a pair whose discipline this build does not know', async () => {
    const db = freshDb();
    // Every cast in this block writes a row the type system forbids, which is the only way to seed what
    // this build's `Tick` cannot express and an earlier build's could have. Phase 0 has no migrations,
    // so such a row is permanent once written.
    await db.ticks.bulkAdd([
      roped('6a'),
      tick({ discipline: 'aid' as Tick['discipline'], grade_raw: '6b' }),
    ]);

    const group = only(await flashRates(db));

    expect(group.rows).toEqual([{ label: '6a', encounters: 1, flashes: 1 }]);
  });

  it('skips a pair whose scale this build does not know rather than throwing', async () => {
    const db = freshDb();
    await db.ticks.bulkAdd([
      roped('6a'),
      tick({ grade_scale: 'uiaa' as ScaleId, grade_raw: 'VII' }),
    ]);

    // Without `isScaleId` the unknown scale reaches `parseOrdinal`, where `labels(scale)` indexes
    // `LABELS_BY_SCALE` with a missing key and `.indexOf` is read off `undefined`. That throws — the
    // promise-rejecting failure `range.ts:68` records, reproduced one layer up and losing the whole
    // screen rather than one discipline's range.
    const group = only(await flashRates(db));

    expect(group.rows).toEqual([{ label: '6a', encounters: 1, flashes: 1 }]);
  });

  it('skips a go whose protection this build does not know, rather than opening on it', async () => {
    const db = freshDb();
    await db.ticks.bulkAdd([roped('6a'), roped('6b', 'via-ferrata' as Protection)]);

    const groups = await flashRates(db);

    // The sharp end of trusting the field: `PROTECTION_ORDER.indexOf` gives `-1`, so an unvalidated
    // value sorts *ahead of lead* and becomes the pane the screen opens on. `SCHEMA_MARKER` does not
    // stand in for the check — it hashes field names and store definitions, not value domains, so an
    // export from a build with a different `Protection` union carries today's marker.
    expect(groups.map((g) => g.protection)).toEqual(['lead']);
    expect(only(groups).rows).toEqual([{ label: '6a', encounters: 1, flashes: 1 }]);
  });
});

/**
 * The comparator, tested directly because no fixture can contradict two of its three terms.
 *
 * `pairsPresent` reads the compound index, so groups are inserted discipline-ascending then
 * scale-ascending — and `'boulder' < 'sport' < 'trad'`, `'font' < 'french'` lexicographically, which is
 * exactly `DISCIPLINE_ORDER` and `SCALE_IDS`. Insertion order therefore already agrees with both
 * tie-breaks, and `Array#sort` is stable, so deleting either one leaves every result a fixture can
 * produce unchanged. The guarantee still matters — it is what stops the reported order depending on how
 * Dexie happens to return keys, which is the divergence from `groupGoes` the design asks for — so it is
 * pinned here instead. Each case is handed its input in reverse, so stability cannot pass for ordering.
 */
describe('byFixedOrder', () => {
  const group = (
    protection: Protection,
    scale: ScaleId,
    discipline: Tick['discipline'],
  ): FlashRateGroup => ({ discipline, scale, protection, rows: [] });

  it('orders by protection before anything else', () => {
    const sorted = [group('none', 'font', 'boulder'), group('lead', 'font', 'sport')].sort(
      byFixedOrder,
    );

    expect(sorted.map((g) => g.protection)).toEqual(['lead', 'none']);
  });

  it('breaks a protection tie by scale', () => {
    const sorted = [group('lead', 'french', 'sport'), group('lead', 'font', 'sport')].sort(
      byFixedOrder,
    );

    expect(sorted.map((g) => g.scale)).toEqual(['font', 'french']);
  });

  it('breaks a protection-and-scale tie by discipline', () => {
    // `sport` and `trad` are the only pair that can reach this term: boulder is pinned to `none`, so it
    // never shares a protection with anything. `trad` has no indoor UI (§7.7), which is why the term
    // exists only to make the order total rather than to be read by a climber.
    const sorted = [group('lead', 'french', 'trad'), group('lead', 'french', 'sport')].sort(
      byFixedOrder,
    );

    expect(sorted.map((g) => g.discipline)).toEqual(['sport', 'trad']);
  });
});
