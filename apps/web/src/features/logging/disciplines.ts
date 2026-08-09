/**
 * What a venue lets you log, and in which notation.
 *
 * A scale is a notation, not a discipline (D17): the same venue may grade boulders in Font and routes
 * in French, and another grades both in French. So the discipline toggle is not a filter over a fixed
 * pair of scales — it selects which of *this venue's* scales the grid renders.
 *
 * A venue carrying no scale for a discipline does not offer it. Tampereen Kiipeilykeskus Lielahti is
 * boulder-only, so no rope option is presented at all — absent rather than disabled, because a
 * disabled control implies the state exists and is forbidden.
 */

import type { ScaleId } from '@tickd/grade-spec';
import type {
  Discipline,
  Protection,
  RopedProtection,
  TickDiscipline,
  Venue,
} from '../../db/types.ts';

/** A discipline this venue offers, with the notation it grades that discipline in. */
export interface DisciplineOption {
  readonly discipline: Discipline;
  readonly scale: ScaleId;
  readonly label: string;
}

/**
 * The disciplines a venue offers, in display order.
 *
 * `trad` never appears: it is in the enum for outdoor completeness only and has no place in the
 * indoor UI (§7.7). Rope maps to `sport`.
 */
export function disciplinesAt(venue: Venue): readonly DisciplineOption[] {
  const options: DisciplineOption[] = [];

  if (venue.default_scale_rope !== undefined) {
    options.push({ discipline: 'sport', scale: venue.default_scale_rope, label: 'Rope' });
  }
  if (venue.default_scale_boulder !== undefined) {
    options.push({ discipline: 'boulder', scale: venue.default_scale_boulder, label: 'Boulder' });
  }

  // `VenueScales` guarantees at least one, so this is never empty — a venue nothing can be logged at
  // is unrepresentable.
  return options;
}

/**
 * The protections available for a discipline.
 *
 * Boulder has exactly one, and it is not a choice: `protection = 'none'` *means* boulder (§7.4), so
 * the two travel together and the control is hidden rather than shown with a single option.
 */
export function protectionsFor(discipline: Discipline): readonly Protection[] {
  return discipline === 'boulder' ? ['none'] : ROPED_PROTECTIONS;
}

/** The roped protections, typed so the control cannot offer `none` — which would mean boulder. */
export const ROPED_PROTECTIONS: readonly RopedProtection[] = ['lead', 'toprope', 'autobelay'];

/**
 * Discipline and protection as one value, preserving stickiness where it makes sense.
 *
 * **Returns the pair, not a bare `protection`.** It used to return just the protection, leaving the
 * caller to put the two back together as separate fields — which is the shape `TickDiscipline` exists
 * to forbid, since `protection: 'none'` *means* boulder (§7.4). Returning the union member is the
 * same computation with the pairing carried along, so no caller can drop half of it.
 *
 * `DESIGN.md` permits a sticky `protection` **because a wrong one is visible on screen** — that
 * visibility is the condition, not a nicety. Switching to boulder forces `none`; switching back
 * restores the previous roped value rather than resetting to lead, since a toprope session stays a
 * toprope session across a bouldering detour.
 */
export function climbOn(
  discipline: Discipline,
  lastRoped: RopedProtection = 'lead',
): TickDiscipline {
  return discipline === 'boulder'
    ? { discipline: 'boulder', protection: 'none' }
    : { discipline, protection: lastRoped };
}
