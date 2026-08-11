import { localDateOf } from '../db/sessions.ts';
import type { Instant, LocalDate } from '../db/types.ts';

/**
 * Dates and durations, in one place because two surfaces read them.
 *
 * `formatDuration` lived in `features/logging/summary.ts` while the summary was its only caller. The
 * history cards need the same string, and the wrong fix would have been to import it from there —
 * history depending on logging for a pure helper neither feature owns. Two copies would have been
 * worse still: a session lasting "1 h 47 min" on one screen and "107 min" on another looks like two
 * different sessions.
 */

/** `1 h 47 min`, or `12 min` under the hour. Rounded down: a session is not a stopwatch. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${String(hours)} h ${String(minutes)} min` : `${String(minutes)} min`;
}

/** `en-GB` gives `Tue 28 Jul` and `17:05` — day before month, and a 24-hour clock without a meridiem. */
const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const CLOCK = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
/** The same clock pinned to UTC, so a stored offset can be applied by shifting the instant. */
const UTC_CLOCK = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

/**
 * `Today`, `Yesterday`, or `Tue 28 Jul`.
 *
 * Reads `date_local` rather than deriving a day from `started_at`, because the stored local date is the
 * authority on which day a session belongs to — a session that began at 22:40 and ran past midnight is
 * still that evening's, and the two fields deliberately disagree in that case (D19).
 *
 * The year is omitted. Every label is unambiguous within a year of use, and Phase 0 is a month-long
 * experiment; a session old enough for the year to matter is one this screen has bigger problems with.
 */
export function dayLabel(dateLocal: LocalDate, now: Date): string {
  const today = localDateOf(now);
  if (dateLocal === today) {
    return 'Today';
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateLocal === localDateOf(yesterday)) {
    return 'Yesterday';
  }

  // Split into parts rather than `new Date(dateLocal)`, which parses `YYYY-MM-DD` as **UTC** and lands
  // on the previous day for anyone west of Greenwich. The parts are already local by construction.
  // Defaulted to `NaN` so the parts are plainly `number` — a missing element and an unparseable one are
  // the same failure and get the same answer.
  const [year = NaN, month = NaN, day = NaN] = dateLocal.split('-').map(Number);
  // `Number.isFinite`, not an `undefined` check. `'not-a-date'.split('-')` yields three parts, so a
  // missing-element guard passes them straight through as `NaN` — and `Intl.DateTimeFormat.format`
  // *throws* `RangeError: Invalid time value` on an invalid date rather than returning something odd.
  // Caught by the test written for exactly this input.
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return dateLocal;
  }
  return DAY.format(new Date(year, month - 1, day));
}

/**
 * The wall-clock time an instant happened at, `18:30`.
 *
 * **`tzOffset` is the whole point, and leaving it out was a bug.** This used to format in the *viewer's*
 * current zone, which is a different question from the one it claims to answer: a Helsinki session logged
 * in July (UTC+3) and read back in December (UTC+2) showed every go an hour early, and a go logged at
 * 00:15 rendered as `23:15` directly beneath a session labelled with the previous day — the date and the
 * time beside it contradicting each other. `tz_offset` is stored on every tick precisely so this can be
 * reconstructed, in the same spirit as `dayLabel` reading stored `date_local` rather than deriving a day.
 *
 * Shifting the instant and formatting as UTC is what pins it: `Intl` has no way to be handed a raw
 * offset, only a named zone, and the stored value is minutes east of UTC rather than a zone name.
 *
 * The offset is optional because `Session` does not carry one — §7.7 gives it `date_local` and instants
 * only. A caller with no offset to hand gets the viewer's zone, which is the old behaviour and the best
 * available answer for a session with no ticks to borrow one from.
 */
export function clockTime(at: Instant, tzOffset?: number): string {
  if (tzOffset === undefined) {
    return CLOCK.format(new Date(at));
  }
  return UTC_CLOCK.format(new Date(at + tzOffset * 60_000));
}
