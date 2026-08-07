/**
 * Phase 0 seed venues.
 *
 * `CONCEPT.md` §7.5: in Phase 0 this is trivial — hardcode the gyms as seed rows. Curation, the
 * "my gym isn't listed" submission path and `canonical_id` merging only become real in Phase 1.
 *
 * **Venues are locations, not brands.** Kiipeilyareena's sites have different walls and different
 * wall heights, and wall height drives the vertical-metres metric — so each site is its own row and
 * `brand` only groups them for display.
 */

import type { TickdDatabase } from './schema.ts';
import type { Venue } from './types.ts';

/**
 * Identifiers are hardcoded rather than generated, and that is what makes seeding idempotent: the
 * same three rows are written on every launch, so a `bulkPut` converges instead of appending a
 * fourth, fifth and sixth venue. Random ids would duplicate the list on every start.
 */
const KIIPEILYAREENA_SALMISAARI = '2f8a1c40-0000-4000-8000-000000000001';
const KIIPEILYAREENA_RISTIKKO = '2f8a1c40-0000-4000-8000-000000000002';
const TAMPEREEN_KIIPEILYKESKUS = '2f8a1c40-0000-4000-8000-000000000003';

/**
 * The seed set.
 *
 * Note what `default_scale_boulder` does across these three rows: **Font at the Kiipeilyareena
 * sites, French at Tampere.** That is not an inconsistency to be tidied away — it is the fact that
 * established a scale is a notation rather than a discipline (D17). One discipline spans two scales,
 * so boulders logged at Tampere and boulders logged at Salmisaari form two separate distributions,
 * and merging them needs a conversion table Phase 0 deliberately does not have.
 *
 * `default_route_length_m` is absent on all three. The real wall heights are not known
 * (`CONCEPT.md` §12 Q1), and a guessed height would silently skew every vertical-metres figure
 * rather than erroring. Absent means the metric has no data, which is honest.
 */
export const SEED_VENUES: readonly Venue[] = [
  {
    id: KIIPEILYAREENA_SALMISAARI,
    type: 'indoor',
    name: 'Kiipeilyareena Salmisaari',
    brand: 'Kiipeilyareena',
    city: 'Helsinki',
    country: 'FI',
    default_scale_rope: 'french',
    default_scale_boulder: 'font',
    pending_review: false,
  },
  {
    id: KIIPEILYAREENA_RISTIKKO,
    type: 'indoor',
    name: 'Kiipeilyareena Ristikko',
    brand: 'Kiipeilyareena',
    city: 'Helsinki',
    country: 'FI',
    default_scale_rope: 'french',
    default_scale_boulder: 'font',
    pending_review: false,
  },
  {
    id: TAMPEREEN_KIIPEILYKESKUS,
    type: 'indoor',
    name: 'Tampereen Kiipeilykeskus',
    city: 'Tampere',
    country: 'FI',
    default_scale_rope: 'french',
    // French, not Font. Tampere grades its boulders in French (§7.3, D17).
    default_scale_boulder: 'french',
    pending_review: false,
  },
];

/**
 * Inserts the seed venues, converging rather than duplicating.
 *
 * `bulkPut` because the seed rows are authoritative in Phase 0: venues are not user-editable, so
 * overwriting them on every launch loses nothing. It also means the set is restored after a JSON
 * import replaces the database (§7.6).
 *
 * **This becomes wrong in Phase 1.** Once §7.5's submission flow exists, a venue can be user-created
 * or user-corrected, and blindly overwriting would discard that. At which point seeding needs to
 * insert-if-absent instead — but that is a Phase 1 problem, not a Phase 0 workaround.
 */
export async function seedVenues(db: TickdDatabase): Promise<void> {
  await db.venues.bulkPut([...SEED_VENUES]);
}
