import type { Tick } from '../../db/types.ts';

/**
 * Pure helpers behind the session summary.
 *
 * Separate from the component so fast refresh keeps working — a file that exports both components
 * and plain functions loses it, and the lint rule says so.
 *
 * `formatDuration` moved to `src/format/time.ts` once the history cards needed the same string. It is
 * re-exported here rather than left behind, because a second implementation would let one screen call a
 * session `1 h 47 min` and another call it `107 min`.
 */

export { formatDuration } from '../../format/time.ts';

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
