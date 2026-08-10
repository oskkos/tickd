import { describe, expect, it } from 'vitest';
import type { FontLabel, FrenchLabel } from '@tickd/grade-spec';
import { newId } from '../../db/schema.ts';
import { groupGoes, groupLabel } from './groups.ts';
import type { Tick, TickDiscipline, TickGrade } from '../../db/types.ts';

/**
 * A tick built from its two paired halves, with **no `as Tick`**.
 *
 * Taking `TickDiscipline & TickGrade` rather than a `Pick` of the fields is what keeps the pairing:
 * `Pick<Tick, 'grade_scale' | 'grade_raw'>` flattens the union to `'french' | 'font'` and
 * `FrenchLabel | FontLabel` independently, so it would happily accept a French `6a` labelled `font` —
 * the exact row the type exists to make unrepresentable. A test factory that can build an impossible
 * row is a test factory that can prove the wrong thing.
 */
function tick(climb: TickDiscipline & TickGrade, created_at = 0): Tick {
  return {
    id: newId(),
    session_id: 's',
    is_send: true,
    prior_experience: 'none',
    date_local: '2026-08-08',
    tz_offset: 180,
    created_at,
    updated_at: 0,
    ...climb,
  };
}

const frenchRope = (grade_raw: FrenchLabel, created_at = 0) =>
  tick({ discipline: 'sport', protection: 'lead', grade_scale: 'french', grade_raw }, created_at);

const fontBoulder = (grade_raw: FontLabel, created_at = 0) =>
  tick({ discipline: 'boulder', protection: 'none', grade_scale: 'font', grade_raw }, created_at);

const frenchBoulder = (grade_raw: FrenchLabel, created_at = 0) =>
  tick({ discipline: 'boulder', protection: 'none', grade_scale: 'french', grade_raw }, created_at);

describe('groupGoes', () => {
  it('leaves a single-scale session as one group', () => {
    const groups = groupGoes([frenchRope('6a'), frenchRope('6b')]);

    // One group is the normal case, and it is what tells the card to drop its headings.
    expect(groups).toHaveLength(1);
    expect(groups[0]?.ticks).toHaveLength(2);
  });

  it('splits a session that ropes in French and boulders in Font', () => {
    const groups = groupGoes([frenchRope('6a'), fontBoulder('6A'), frenchRope('6b')]);

    // The Salmisaari case. Ungrouped, `6a` and `6A` sit adjacent differing only by letter case, which
    // reads as one scale containing a typo rather than as two ordinal namespaces.
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => [g.discipline, g.scale])).toEqual([
      ['sport', 'french'],
      ['boulder', 'font'],
    ]);
  });

  it('still splits by discipline when one notation serves both', () => {
    const groups = groupGoes([frenchRope('6a'), frenchBoulder('6a')]);

    // Tampere Nekala grades both in French. A shared notation does not make a boulder comparable to a
    // route (D17), so scale alone cannot be the key.
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.discipline)).toEqual(['sport', 'boulder']);
  });

  it('does not merge two disciplines that happen to share a scale with a third', () => {
    // Guards the composite key against collapsing to either half: three distinct pairs, two of which
    // share a discipline and two of which share a scale.
    const groups = groupGoes([frenchRope('6a'), fontBoulder('6A'), frenchBoulder('6b')]);

    expect(groups).toHaveLength(3);
  });

  it('orders groups by first appearance, not by discipline', () => {
    const groups = groupGoes([fontBoulder('6A'), frenchRope('6a')]);

    // An evening that started on the boulder wall should read that way.
    expect(groups.map((g) => g.discipline)).toEqual(['boulder', 'sport']);
  });

  it('preserves order within a group', () => {
    const groups = groupGoes([frenchRope('6a', 1), frenchRope('6b', 2), frenchRope('6c', 3)]);

    expect(groups[0]?.ticks.map((t) => t.grade_raw)).toEqual(['6a', '6b', '6c']);
  });

  it('returns nothing for no goes', () => {
    expect(groupGoes([])).toEqual([]);
  });
});

describe('groupLabel', () => {
  it('names the discipline and the notation', () => {
    expect(groupLabel({ discipline: 'sport', scale: 'french', ticks: [] })).toBe('rope · French');
    expect(groupLabel({ discipline: 'boulder', scale: 'font', ticks: [] })).toBe('boulder · Font');
  });

  it('calls a French-graded boulder what it is', () => {
    // Not "French" implying rope: the notation and the discipline are independent.
    expect(groupLabel({ discipline: 'boulder', scale: 'french', ticks: [] })).toBe(
      'boulder · French',
    );
  });
});
