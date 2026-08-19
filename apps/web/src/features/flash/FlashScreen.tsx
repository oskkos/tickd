import { useEffect, useState } from 'react';
import { flashRates, type FlashRateGroup } from '../../db/flashRate.ts';
import { db } from '../../db/schema.ts';
import type { Protection } from '../../db/types.ts';
import { defaultProtection, protectionsPresent } from './panes.ts';
import { ProtectionSelector } from './ProtectionSelector.tsx';
import { RateChart } from './RateChart.tsx';

/**
 * Flash rate by grade — the one analytic Phase 0 ships (`CONCEPT.md` §4.2, §9.0).
 *
 * **One analytic, and holding to that is the phase's stated main risk.** No pyramid, no volume, no
 * vertical metres — wall heights are seeded absent (§12 Q1) so the figure cannot even be computed — no
 * trend, no median grade, no send rate by `angle` or `holds`. The last of those is not an oversight:
 * annotations are recorded while describing a climb, so any metric keyed on them skews toward sends
 * (D19, D21).
 *
 * **Read-only, all of it.** No Dexie write, no correction control, no long-press. A go is repaired from the
 * session detail, which stays the only repair path (D23) — a second one would be a second place the
 * whole-union rules for `correctGrade` and friends have to be honoured.
 *
 * **A snapshot on mount, not a subscription.** `useEffect` into `useState`, as every other screen does;
 * `dexie-react-hooks` is a dependency and deliberately unused. The cost is real and accepted: leave this
 * screen open, log a go on another tab, and the numbers are stale until you come back. It is a screen you
 * open between climbs.
 *
 * **The whole logbook, with no window control.** Phase 0 holds no data older than the install, so a window
 * would be a control over data that cannot exist. Contrast the grade grid's `workingRange`, which *is*
 * windowed — it answers "where is the climber now", where this answers "how does the rate fall away with
 * grade" over everything there is. All-time does become the wrong window once a logbook spans a year;
 * that arrives with the pyramid in Phase 1, which needs a window of its own anyway.
 */

/**
 * Three states, kept apart on purpose: the read has not landed, there is nothing to divide, or there are
 * charts. Collapsing the first two is how an empty state comes to flash up before the data arrives.
 */
export function FlashScreen() {
  const [groups, setGroups] = useState<readonly FlashRateGroup[] | undefined>();
  // Component state, and neither of the two things it could have been. **Not a search param**: the back
  // gesture has to move between tabs (`app-shell`), and threading protection into the address would make
  // back step through selector taps instead of leaving the screen. **Not a stored preference**: the
  // preferences module is for choices that are annoying to redo, like theme and haptics, and this is one
  // tap on a screen you arrive at with a default that is already right.
  const [chosen, setChosen] = useState<Protection | undefined>();

  useEffect(() => {
    void flashRates(db).then(setGroups, (error: unknown) => {
      // An empty result is a state this screen already renders, so a failed read degrades to the day-one
      // prose rather than to a blank frame and an unhandled rejection — the failure `SessionsScreen`
      // fixed the same way.
      console.error('[tickd] could not read flash rates', error);
      setGroups([]);
    });
  }, []);

  if (groups === undefined) {
    // Nothing rather than a spinner: one pass over a local database, so a spinner would flash for a frame
    // and read as jank. `undefined` is distinct from `[]` precisely so the empty state waits for the read.
    return <div className="flex min-h-0 flex-1 flex-col gap-4" />;
  }

  const entries = protectionsPresent(groups);
  // The chosen pane, falling back to the default rather than being written into state by a second effect.
  // Derived because the default depends on data that arrives after mount: an effect that set state once the
  // read landed would render an empty pane for one frame and would need a guard against overwriting a
  // choice the climber had already made.
  //
  // **No membership check, and the reason is worth stating so it is not re-added as a precaution.**
  // `groups` is a mount-time snapshot and `entries` derives from it, so the list cannot change while this
  // component is mounted; `chosen` is only ever set by the selector, which renders `entries`. A pane
  // therefore cannot go missing under the selection, and a check for it would be unreachable code
  // asserting a guarantee that already holds one line up. **It stops holding the moment this read becomes
  // reactive** — `dexie-react-hooks` observing the ticks table would let `entries` shrink beneath a live
  // selection — and that is when the check earns its place, not before.
  const active = chosen ?? defaultProtection(entries);

  if (active === undefined) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <h2 className="shrink-0 text-2xl">Flash rate</h2>
        {/*
          What will appear and roughly when, per `DESIGN.md`'s day-one rule — no axis, no zero rows, no
          reference rule and no selector. An axis with nothing on it would be worse than prose, because an
          empty chart says *your rate is zero* where prose says *there is nothing to divide yet*.

          **The condition is no first encounters, not no ticks**, which is why the second sentence is here.
          `flashRates` returns no group for a protection climbed entirely as attempts and repeats, so a
          climber who logged an evening of projecting lands on this screen — and would otherwise read the
          prose as a bug, having plainly logged something.
        */}
        <p className="text-sm opacity-70">
          Nothing to divide yet. This screen counts <em>first goes</em> — the climbs you met for the
          first time, whether or not you got them — and shows how often you flashed them, grade by
          grade.
        </p>
        <p className="text-sm opacity-70">
          Goes on climbs you had tried or sent before are not counted, so a session of repeats
          leaves this empty. Expect it to start saying something after three or four weeks: it takes
          roughly ten first goes at a grade before the number is worth reading.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="shrink-0">
        <h2 className="text-2xl">Flash rate</h2>
        {/*
          The definition, said once. §4.2's denominator is the surprising half — the climbs you walked away
          from are what keep the number honest at the limit grade (D14) — and a reader who assumes it is
          flashes over sends reads every row too high.
        */}
        <p className="text-sm opacity-70">
          Flashes ÷ first goes, including the ones you walked away from.
        </p>
      </div>

      <ProtectionSelector entries={entries} value={active} onChange={setChosen} />

      {/* One chart per scale in the selected pane, already ordered by `byFixedOrder`. The list is the
          scroller, since the charts are the only thing here that grows — boulder alone spans two scales
          under today's seed (D17). */}
      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto">
        {groups
          .filter((group) => group.protection === active)
          .map((group) => (
            <RateChart key={`${group.discipline}:${group.scale}`} group={group} />
          ))}
      </div>
    </div>
  );
}
