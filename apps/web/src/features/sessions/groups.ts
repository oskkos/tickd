import type { ScaleId } from '@tickd/grade-spec';
import { protectionLabel } from '../../format/climbing.ts';
import type { Discipline, Tick } from '../../db/types.ts';

/**
 * Goes split by the only key that makes their grades comparable.
 *
 * **`(discipline, grade_scale)` is one key, and neither half can do the other's job.** Grouping by
 * discipline alone pools Font and French boulders into one run of incomparable values; grouping by
 * scale alone pools boulders with routes. Both produce something plausible rather than an error, which
 * is exactly why every metric in the project uses this pair — and a session card is the first surface
 * where the pair shows up in the UI rather than in a query.
 *
 * The case that forces it is real and seeded: Kiipeilyareena Salmisaari grades rope in French and
 * boulder in Font, so one visit yields `6a` and `6A` — labels differing only in letter case, from
 * separate ordinal namespaces. Rendered as one run they read as a single scale with a typo in it.
 *
 * And the case that stops discipline being redundant is also seeded: Tampereen Kiipeilykeskus Nekala
 * grades *both* disciplines in French, so a shared notation does not make a boulder comparable to a
 * route (D17).
 */
export interface GoGroup {
  readonly discipline: Discipline;
  readonly scale: ScaleId;
  readonly ticks: readonly Tick[];
}

/**
 * Splits goes into groups, in the order the groups first appear.
 *
 * First-appearance order rather than a fixed rope-then-boulder order: the card is a record of a visit,
 * and if the evening started on the boulder wall that is what it should read like.
 *
 * A single group is the normal case, and the caller is expected to drop the labels when there is only
 * one — a heading that never varies is noise. This function does not decide that, because "how many
 * groups are there" is the question the caller is asking it.
 *
 * Order within each group is preserved, so a caller that hands over chronological ticks gets
 * chronological groups.
 */
export function groupGoes(ticks: readonly Tick[]): readonly GoGroup[] {
  const groups = new Map<string, { discipline: Discipline; scale: ScaleId; ticks: Tick[] }>();

  for (const tick of ticks) {
    // The composite key spelled out, so it cannot silently collapse to one half of itself.
    const key = `${tick.discipline}:${tick.grade_scale}`;
    const existing = groups.get(key);
    if (existing) {
      existing.ticks.push(tick);
    } else {
      groups.set(key, { discipline: tick.discipline, scale: tick.grade_scale, ticks: [tick] });
    }
  }

  return [...groups.values()];
}

/**
 * How the session was climbed, in first-appearance order: `lead`, `lead, toprope`, `lead, boulder`.
 *
 * **`none` reads as `boulder`, because that is what it means.** Listing it as a protection would offer
 * "no protection" as a fourth way of being roped; §7.4 defines the absence of protection as what
 * distinguishes a boulder, so the word for it is the discipline.
 *
 * The wording comes from `format/climbing.ts` rather than being spelled out here. It was spelled out
 * here, once — and `protectionLabel` is the function every surface that shows a go already calls, so the
 * copy was a second place the same rule could be changed in.
 */
export function protectionsUsed(ticks: readonly Tick[]): readonly string[] {
  const seen: string[] = [];
  for (const tick of ticks) {
    const word = protectionLabel(tick.protection);
    if (!seen.includes(word)) {
      seen.push(word);
    }
  }
  return seen;
}

/** How a group names itself: the discipline, then the notation its grades are written in. */
export function groupLabel(group: GoGroup): string {
  const discipline = group.discipline === 'boulder' ? 'boulder' : 'rope';
  // `font` and `french` are notations, so they read as proper nouns rather than as enum values.
  const notation = group.scale === 'font' ? 'Font' : 'French';
  return `${discipline} · ${notation}`;
}
