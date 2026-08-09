import { describe, expect, it } from 'vitest';
import { SEED_VENUES } from '../../db/seed.ts';
import { climbOn, disciplinesAt, protectionsFor } from './disciplines.ts';
import type { TickDiscipline, Venue } from '../../db/types.ts';

function seeded(name: string): Venue {
  const venue = SEED_VENUES.find((v) => v.name === name);
  if (!venue) {
    throw new Error(`no seeded venue named ${name}`);
  }
  return venue;
}

describe('disciplinesAt', () => {
  it('offers both disciplines where the venue grades both', () => {
    const options = disciplinesAt(seeded('Kiipeilyareena Salmisaari'));

    expect(options.map((o) => o.discipline)).toEqual(['sport', 'boulder']);
  });

  it('renders each discipline in the notation that venue grades it in', () => {
    const areena = disciplinesAt(seeded('Kiipeilyareena Salmisaari'));
    const tampere = disciplinesAt(seeded('Tampereen Kiipeilykeskus Nekala'));

    // The point of D17, visible in the UI: one discipline, two scales across venues.
    expect(areena.find((o) => o.discipline === 'boulder')?.scale).toBe('font');
    expect(tampere.find((o) => o.discipline === 'boulder')?.scale).toBe('french');
  });

  it('lets one scale serve both disciplines', () => {
    const options = disciplinesAt(seeded('Tampereen Kiipeilykeskus Nekala'));

    // Nothing may treat 'font' as "the boulder scale" — Tampere grades both in French.
    expect(options.every((o) => o.scale === 'french')).toBe(true);
  });

  it('offers no rope option at a boulder-only venue', () => {
    const options = disciplinesAt(seeded('Tampereen Kiipeilykeskus Lielahti'));

    // Absent, not disabled. A disabled control implies the state exists and is forbidden.
    expect(options.map((o) => o.discipline)).toEqual(['boulder']);
  });

  it('never offers trad, which exists for outdoor completeness only', () => {
    for (const venue of SEED_VENUES) {
      expect(disciplinesAt(venue).some((o) => o.discipline === 'trad')).toBe(false);
    }
  });

  it('always offers at least one discipline at every seeded venue', () => {
    for (const venue of SEED_VENUES) {
      expect(disciplinesAt(venue).length).toBeGreaterThan(0);
    }
  });
});

describe('protection', () => {
  it('gives boulder exactly one, which is not a choice', () => {
    expect(protectionsFor('boulder')).toEqual(['none']);
  });

  it('gives roped disciplines the three roped options and no none', () => {
    expect(protectionsFor('sport')).toEqual(['lead', 'toprope', 'autobelay']);
    expect(protectionsFor('sport')).not.toContain('none');
  });

  it('forces none when switching to boulder', () => {
    expect(climbOn('boulder', 'toprope')).toEqual({ discipline: 'boulder', protection: 'none' });
  });

  it('restores the previous roped protection after a bouldering detour', () => {
    // A toprope session stays a toprope session; resetting to lead would silently change what gets
    // recorded, and protection is sticky precisely because it stays visible.
    expect(climbOn('sport', 'toprope')).toEqual({ discipline: 'sport', protection: 'toprope' });
  });

  it('defaults to lead when there is no previous value', () => {
    expect(climbOn('sport')).toEqual({ discipline: 'sport', protection: 'lead' });
  });

  it('hands back both halves at once, so neither can be dropped', () => {
    // The reason this returns a pair rather than a bare protection: a caller holding only the
    // protection has to re-pair it with a discipline, and re-pairing is where `{ boulder, lead }`
    // came from. `TickDiscipline` is not satisfiable one field at a time.
    const climb: TickDiscipline = climbOn('boulder');
    expect(Object.keys(climb).sort()).toEqual(['discipline', 'protection']);
  });
});
