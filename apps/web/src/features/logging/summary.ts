import type { Tick } from '../../db/types.ts';

/**
 * Pure helpers behind the session summary.
 *
 * Separate from the component so fast refresh keeps working — a file that exports both components
 * and plain functions loses it, and the lint rule says so.
 */

/** `1 h 47 min`, or `12 min` under the hour. Rounded down: a session is not a stopwatch. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${String(hours)} h ${String(minutes)} min` : `${String(minutes)} min`;
}

/**
 * The session's goes in the order they happened.
 *
 * Oldest first — a summary is the story of the session, and the recent list is already newest-first
 * for undo. Not tallied by grade: two goes on the same grade may be a flash and a fall, and rolling
 * them into `6a ×2` throws away the difference the whole model exists to record.
 */
export function goesInOrder(ticks: readonly Tick[]): Tick[] {
  return [...ticks].sort((a, b) => a.created_at - b.created_at);
}
