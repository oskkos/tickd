/**
 * Flash rate by grade — the one analytic Phase 0 ships (`CONCEPT.md` §4.2, §9.0, D14).
 *
 * Beside `range.ts` and for the same reason: this is a read over the `[discipline+grade_scale]`
 * compound index that returns a shape the UI renders, and the grouping rule is a data invariant
 * rather than a presentation choice. Where the bar is drawn is the screen's business; *what may be
 * counted together* is this module's, and it is not negotiable per surface.
 *
 * **This is the first query the compound index was added for.** `schema.ts` justifies
 * `[discipline+grade_scale]` with "because **every metric groups by that pair**", and until now no
 * metric existed — `range.ts` reads the index but positions a grid rather than reporting a number.
 *
 * Three things this module deliberately does not do:
 *
 * - **It does not compute a rate.** Rows carry counts. A stored rate would be a value computable from
 *   its two neighbours and therefore able to disagree with them, which is the rule that keeps
 *   `send_style` derived (§7.3, D20) and that forbids a baked-in grade ordinal (§7.3, §8.4).
 * - **It does not define the metric.** `isFirstEncounter` and `isFlash` come from `style.ts`, where
 *   D14's argument lives. A second copy here is a second definition, free to drift from the one every
 *   display of a go already uses.
 * - **It does not suppress, elide or lay anything out.** The n < 3 fill rule and the collapsing of
 *   empty grades into a gap row are rendering concerns; the shape here stays complete and honest so
 *   that a rendering change cannot quietly become a change to the data.
 */

import { clampRange, parseOrdinal, SCALE_IDS, type ScaleId } from '@tickd/grade-spec';
import type { IndexableType } from 'dexie';
import type { TickdDatabase } from './schema.ts';
import { isFirstEncounter, isFlash } from './style.ts';
import type { Discipline, Protection } from './types.ts';

/**
 * One grade's counts, never its rate.
 *
 * `label` is a plain `string` rather than `FontLabel | FrenchLabel`. It comes out of
 * `labels(group.scale)`, so it is a label of its own group's scale *by construction* — whereas the
 * two-scale union would happily let a Font label sit in a French group, which is the one error worth
 * preventing here. The consumer renders it verbatim (§7.3 forbids case-transforming it), so the
 * narrower type would buy precision nobody uses at the cost of implying a guarantee it does not give.
 *
 * `encounters` is the number of first encounters at this grade and `flashes` the number of those that
 * were sent first go. `flashes <= encounters` always, because the numerator's predicate implies the
 * denominator's. A row may be `{ encounters: 0, flashes: 0 }` — see `rows` on the group.
 */
export interface FlashRateRow {
  readonly label: string;
  readonly encounters: number;
  readonly flashes: number;
}

/**
 * One chart's worth of data: a `(discipline, scale, protection)` key and its grades.
 *
 * **All three parts are the key, and none of them is a filter applied afterwards.** Neither half of
 * `(discipline, grade_scale)` can do the other's job (§4.2, D17): discipline alone pools Font and
 * French boulders into one ranking of incomparable values, scale alone pools boulders with routes.
 * Protection joins them because pooling a toprope flash with a lead flash at the same grade raises the
 * curve exactly where the crossing is read — pooling breaks the metric rather than merely blurring it.
 *
 * Boulder needs no special case. `protection: 'none'` *means* boulder (§7.4) and `TickDiscipline`
 * guarantees the pairing, so boulder falls out as its own group from the same key everything else uses.
 *
 * `rows` is a **contiguous span**, easiest first, from the easiest to the hardest grade holding a first
 * encounter — so both ends are observed by construction and there is never a leading or trailing empty
 * row. Interior grades with no first encounter are present as `{ encounters: 0, flashes: 0 }`. That is
 * on purpose: `0/0` is not a rate, and a renderer that wants to collapse a run of them into one gap row
 * needs to know how long the run is. Dropping them here would leave the renderer to reconstruct the
 * gap from a jump in grade labels, which is the same information behind a worse interface.
 */
export interface FlashRateGroup {
  readonly discipline: Discipline;
  readonly scale: ScaleId;
  readonly protection: Protection;
  readonly rows: readonly FlashRateRow[];
}

/**
 * The fixed order groups are reported in.
 *
 * **Fixed, not first-appearance — the deliberate divergence from `groupGoes`.** A session card is a
 * record of a visit, so if the evening started on the boulder wall that is what it should read like;
 * this is a reference screen you return to between climbs, and one that reorders itself because last
 * night's session began differently is disorienting at exactly the moment you are trying to compare
 * against your own memory of it. `groups.ts`'s reasoning is right for its surface and wrong for this one.
 *
 * `none` sits last and is the boulder group. It is not named here, because naming it is presentation:
 * `format/climbing.ts`'s `protectionLabel` already resolves it to the word *boulder*, "because that is
 * what it means" — it is the single authority on that, for the selector here as for every surface that
 * shows a go.
 *
 * Exported so the selector orders itself from the same list rather than from a second copy of it.
 *
 * **Deliberately not `ROPED_PROTECTIONS` from `features/logging/disciplines.ts`.** That list is typed
 * `RopedProtection`, which *excludes* `none` — correct there, since the protection control must not
 * offer "no protection" as a fourth way of being roped, and wrong here, where boulder is one of the four
 * groups. A `db/` module importing from `features/` would also invert the layering every other file in
 * this directory keeps.
 */
export const PROTECTION_ORDER: readonly Protection[] = ['lead', 'toprope', 'autobelay', 'none'];

/**
 * Disciplines, in the order they break ties.
 *
 * Only `sport` and `trad` can ever tie — they share the roped protections, while `boulder` is pinned to
 * `none` — and `trad` never appears in the indoor UI at all (§7.7). So this exists purely so that the
 * order is total and does not fall back on the order Dexie happened to return the index keys in.
 */
const DISCIPLINE_ORDER: readonly Discipline[] = ['boulder', 'sport', 'trad'];

/** Running counts for one grade of one group, before it becomes a row. */
interface Tally {
  encounters: number;
  flashes: number;
}

/**
 * Whether a value read back out of an index key is a discipline this build knows.
 *
 * The same shape as `grade-spec`'s `isLabel`, and here for the same reason `parseOrdinal` is used
 * below: Phase 0 has no migrations, so a row written by an earlier build is permanent, and a
 * discipline the current build does not recognise must be skipped rather than crash the surface.
 */
function isDiscipline(value: unknown): value is Discipline {
  return typeof value === 'string' && (DISCIPLINE_ORDER as readonly string[]).includes(value);
}

/** Whether a value read back out of an index key is a scale this build knows. See `isDiscipline`. */
function isScaleId(value: unknown): value is ScaleId {
  return typeof value === 'string' && (SCALE_IDS as readonly string[]).includes(value);
}

/**
 * Whether a row's `protection` is one this build knows.
 *
 * Checked for the same reason as the two above, and the type says nothing about it: `tick.protection` is
 * typed `Protection` because `Tick` says so, and a row read back off disk is only as true to `Tick` as
 * the build that wrote it. **`SCHEMA_MARKER` does not close this**, either for a stale local database or
 * for an imported file — it hashes field *names* and the store definitions, not the value domains behind
 * them, so a build whose `Protection` union differed produces exports carrying today's marker.
 *
 * **Skipping is the only honest handling**, and the failure it prevents is worse than a dropped row. An
 * unrecognised value would become a `Map` key, then a group's `protection`, then a selector entry — and
 * `PROTECTION_ORDER.indexOf` would return `-1` for it, sorting it *ahead of lead* and making it the
 * default pane the screen opens on. A protection that cannot be named cannot be assigned to a pane, so a
 * go carrying one is uncountable here in exactly the way a go whose label its scale does not know is.
 */
function isProtection(value: unknown): value is Protection {
  return typeof value === 'string' && (PROTECTION_ORDER as readonly string[]).includes(value);
}

/**
 * The distinct `(discipline, grade_scale)` pairs actually present, read from the index itself.
 *
 * `uniqueKeys()` walks the compound index rather than the rows, so this costs nothing and — more to the
 * point — the set of groups is **derived from the ticks, never from a fixed list**. Under the seeded
 * venues boulder alone spans two scales (Font at the Kiipeilyareena sites, French at Tampere, D17), so
 * a hardcoded set of panes would either drop a scale or pool two notations whose labels differ only in
 * letter case. Enumerating `DISCIPLINE_ORDER × SCALE_IDS` would give the same answer today and would
 * stop doing so the moment a scale is added to the spec without this file being revisited.
 */
async function pairsPresent(
  db: TickdDatabase,
): Promise<readonly (readonly [Discipline, ScaleId])[]> {
  const keys: readonly IndexableType[] = await db.ticks
    .orderBy('[discipline+grade_scale]')
    .uniqueKeys();

  const pairs: (readonly [Discipline, ScaleId])[] = [];
  for (const key of keys) {
    // A compound index key is an array. Both members are checked rather than asserted: the index is
    // ours, but the rows in it may predate this build.
    if (!Array.isArray(key)) {
      continue;
    }
    const [discipline, scale] = key;
    if (isDiscipline(discipline) && isScaleId(scale)) {
      pairs.push([discipline, scale]);
    }
  }
  return pairs;
}

/**
 * Flash rate for every `(discipline, scale, protection)` present, as counts per grade.
 *
 * **All time, and no window parameter.** Phase 0 holds no data older than the install, so a window
 * would be a control over data that cannot exist; the pyramid's rolling twelve months arrives with
 * Phase 1, which needs a window for its own reasons. Contrast `workingRange`, which *is* windowed —
 * it answers "where is the climber now" and stale ticks would mis-position the grid, whereas this
 * answers "how does the rate fall away with grade" over everything there is.
 *
 * **Membership is *has a first encounter*, not *has ticks*.** A protection climbed entirely as attempts
 * and repeats has no rate to report, so it yields no group at all rather than an empty one — which is
 * what lets the selector be built from this result directly and never offer a pane with nothing in it.
 *
 * A snapshot, not a subscription. Every screen reads through `useEffect` into `useState`;
 * `dexie-react-hooks` is available and deliberately unused (design.md).
 */
export async function flashRates(db: TickdDatabase): Promise<readonly FlashRateGroup[]> {
  // **One read transaction, because the snapshot is taken in two steps.** `pairsPresent` walks the index
  // for the pairs, then each pair is read separately — so without a transaction a write landing between
  // them yields a result where one pair reflects the write and a *newly created* pair is missing from the
  // loop altogether. That failure is not staleness: the chart for that pair silently does not exist,
  // which is indistinguishable from having logged nothing there. Two tabs is the case the screen's own
  // comment already treats as real, and `logbook.ts` reaches for the same fix.
  return db.transaction('r', db.ticks, () => collectRates(db));
}

async function collectRates(db: TickdDatabase): Promise<readonly FlashRateGroup[]> {
  const groups: FlashRateGroup[] = [];

  for (const [discipline, scale] of await pairsPresent(db)) {
    // The index narrows to the pair; protection groups in memory. A three-part key against a two-part
    // index is the deliberate trade: a month of one climber's ticks is a few hundred rows, and adding
    // an index would move `SCHEMA_MARKER` and refuse every export taken before this change (§7.6, D24).
    const ticks = await db.ticks
      .where('[discipline+grade_scale]')
      .equals([discipline, scale])
      .toArray();

    const byProtection = new Map<Protection, Map<number, Tally>>();

    for (const tick of ticks) {
      // The denominator's predicate first: a tick that is not a first encounter contributes to neither
      // count *and* does not put its grade in the span. Both halves matter — a grade held up only by
      // repeats would otherwise widen the span and appear as an unmet `0/0` grade, which is a claim
      // about the climber's range drawn from rows the metric does not measure.
      if (!isFirstEncounter(tick)) {
        continue;
      }

      // `parseOrdinal`, not `ordinalOf`. `TickGrade` pairs `grade_raw` with `grade_scale` for rows this
      // build wrote; it cannot for rows already on disk, and Phase 0 has no migrations so an
      // unrecognised label is permanent. `ordinalOf` throws, and `range.ts:68` records what that cost
      // there: one such row inside a `.map` rejected the whole promise and left a discipline with no
      // working range for ninety days. Skipping drops the row from the counts *and* from the span —
      // dropping it from the counts alone would let it reappear as an unmet grade, which is the same
      // false claim in quieter form.
      const ordinal = parseOrdinal(tick.grade_raw, tick.grade_scale);
      if (ordinal === undefined) {
        continue;
      }

      // The third of the three "this row may predate the build" checks, and the one the type system
      // makes look unnecessary. See `isProtection`: an unrecognised value sorts ahead of lead and
      // becomes the screen's default pane, which is a louder failure than dropping the go.
      if (!isProtection(tick.protection)) {
        continue;
      }

      let tallies = byProtection.get(tick.protection);
      if (!tallies) {
        tallies = new Map<number, Tally>();
        byProtection.set(tick.protection, tallies);
      }

      let tally = tallies.get(ordinal.index);
      if (!tally) {
        tally = { encounters: 0, flashes: 0 };
        tallies.set(ordinal.index, tally);
      }

      tally.encounters += 1;
      if (isFlash(tick)) {
        tally.flashes += 1;
      }
    }

    for (const [protection, tallies] of byProtection) {
      groups.push({ discipline, scale, protection, rows: rowsFor(scale, tallies) });
    }
  }

  return groups.sort(byFixedOrder);
}

/**
 * The contiguous span for one group, easiest first.
 *
 * `tallies` is never empty here — a protection reaches this only by having tallied a first encounter,
 * which is the membership rule — so `min`/`max` are over observed grades and both ends of the span are
 * observed by construction.
 *
 * `clampRange` supplies the labels, and **this is its first production caller** — an earlier version of
 * this comment claimed the grade grid's working range was built from it, which is false and was found by
 * review. `range.ts` returns bare `{ from, to }` indices, and `GradeGrid.tsx` deliberately renders the
 * whole scale rather than truncating to them, so nothing had reached for a span of labels before now.
 *
 * It is still the right primitive, on its own merits rather than on precedent: it is `grade-spec`'s
 * definition of *a contiguous span of one scale's labels*, which keeps the easiest-first direction
 * (`DESIGN.md` §5) in the module that owns label order instead of in a second hand-rolled slice of
 * `labels(scale)` here. Its clamping is redundant for these inputs — both ends come from `parseOrdinal`
 * against this same scale — and harmlessly so.
 */
function rowsFor(scale: ScaleId, tallies: Map<number, Tally>): readonly FlashRateRow[] {
  const indices = [...tallies.keys()];
  const from = Math.min(...indices);

  return clampRange(from, Math.max(...indices), scale).map((label, offset) => {
    const tally = tallies.get(from + offset);
    // An interior grade with no first encounter, kept as a zero row. `0/0` is not a rate and must
    // never be drawn as 0% — the renderer collapses runs of these into one gap row, and it can only
    // do that if the run is present to be counted.
    return { label, encounters: tally?.encounters ?? 0, flashes: tally?.flashes ?? 0 };
  });
}

/**
 * Protection, then scale, then discipline — see `PROTECTION_ORDER`.
 *
 * Ties are impossible: the triple is the group key, so two groups never compare equal and the sort's
 * stability is not being relied on to hide anything.
 *
 * **Exported for its own test, which no fixture can write.** `pairsPresent` walks the compound index, so
 * groups are inserted discipline-ascending then scale-ascending — and `'boulder' < 'sport' < 'trad'` and
 * `'font' < 'french'` lexicographically, which is exactly `DISCIPLINE_ORDER` and `SCALE_IDS`. Insertion
 * order therefore already agrees with two of the three terms below, and `Array#sort` is stable, so
 * deleting either term leaves every reachable result unchanged. The guarantee is real — it is what stops
 * the order depending on how Dexie happens to return keys — but only a direct test of the comparator can
 * hold it, so the function is exported rather than left private and unpinned. Found by review.
 */
export function byFixedOrder(a: FlashRateGroup, b: FlashRateGroup): number {
  return (
    PROTECTION_ORDER.indexOf(a.protection) - PROTECTION_ORDER.indexOf(b.protection) ||
    SCALE_IDS.indexOf(a.scale) - SCALE_IDS.indexOf(b.scale) ||
    DISCIPLINE_ORDER.indexOf(a.discipline) - DISCIPLINE_ORDER.indexOf(b.discipline)
  );
}
