/**
 * Storage boot sequence.
 *
 * Two things happen at startup and they are deliberately sequenced differently:
 *
 * - **Seeding is awaited.** Nothing may read venues before the seed rows exist, or the venue picker
 *   would render empty on a first launch. One await at boot beats a readiness guard scattered
 *   through every caller.
 * - **Persistence is not awaited.** It is an eviction hint, not a precondition for logging, and
 *   `persist()` can prompt the user in some browsers. Blocking first paint on a permission dialog
 *   would be worse than the eviction risk it mitigates.
 */

import { db } from './schema.ts';
import { seedVenues } from './seed.ts';
import { requestPersistence } from './persist.ts';
import { closeIfIdle, type LazyCloseResult } from './sessions.ts';

/**
 * Whether the logbook can actually be used, and if not, why.
 *
 * Returned rather than logged. An earlier version swallowed every failure into `console.error` and
 * resolved normally, so the app rendered an empty venue picker with no explanation — the exact state
 * its own comment called "the one state that looks like data loss rather than a cold start". Found by
 * review. The caller now has something to render.
 */
export type StorageStatus = 'ready' | 'unavailable' | 'timeout';

/** What startup found and did, for the UI to report. */
export interface StartupResult {
  readonly status: StorageStatus;
  /** A session left running and closed on this launch, if there was one. Announced, never silent. */
  readonly lazyClose?: LazyCloseResult;
}

/**
 * How long to wait for IndexedDB before giving up and rendering anyway.
 *
 * A rejecting IndexedDB was already handled; a **hanging** one was not. Dexie waits indefinitely when
 * the open request neither succeeds nor errors, which happens on the `blocked` event — another tab
 * holding a connection — and on the WebKit bug where `indexedDB.open` fires no event at all on a
 * fresh page load. Without a bound, the awaited promise never settles and the user gets a permanently
 * blank page.
 *
 * Five seconds is far longer than a real open (single-digit milliseconds, even cold) and short enough
 * that a stuck launch still produces a usable screen rather than a white one.
 */
const OPEN_TIMEOUT_MS = 5_000;

/**
 * Prepares storage for reading.
 *
 * Never rejects and never hangs. A logbook that cannot save is bad; a blank screen is worse, because
 * it gives the user nothing to act on and no reason to suspect their browser rather than the app.
 */
export async function initialiseStorage(now: Date = new Date()): Promise<StartupResult> {
  // Fire-and-forget: the outcome is informational, and awaiting it would gate the UI on a dialog.
  void requestPersistence().then(
    (outcome) => {
      if (outcome !== 'persisted') {
        // Not an error. Safari reports 'unsupported' by design, and Phase 0 accepts evictable
        // storage as a stated trade-off (§7.6).
        console.info(`[tickd] storage persistence: ${outcome}`);
      }
    },
    () => {
      /* requestPersistence already swallows its own failures; this is belt and braces. */
    },
  );

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => {
      resolve('timeout');
    }, OPEN_TIMEOUT_MS);
  });

  try {
    // **Everything awaited before first paint goes inside the race.** The lazy close used to sit
    // after it, which quietly gave the boot an unbounded tail: the timeout had already settled, so a
    // stall on that second transaction — a `versionchange` from another tab, or the same WebKit bug
    // landing one operation later — left the promise unsettled and the page permanently blank, which
    // is the exact outcome the bound exists to prevent. Found by review.
    //
    // The lazy close runs only once seeding has succeeded, so storage is known good by the time it
    // reads. A session left running is the normal case, not an error — nobody does admin on the way
    // out of a gym.
    const result = await Promise.race([seedVenues(db).then(() => closeIfIdle(db, now)), timeout]);

    if (result === 'timeout') {
      // The pending work is deliberately not cancelled — Dexie has no cancellation, and if the open
      // eventually completes the rows land anyway. The user simply is not made to wait for it.
      console.error(`[tickd] storage did not open within ${String(OPEN_TIMEOUT_MS)}ms`);
      return { status: 'timeout' };
    }

    return result.closed ? { status: 'ready', lazyClose: result } : { status: 'ready' };
  } catch (error) {
    // Firefox private browsing rejects on open, and quota exhaustion can too.
    console.error('[tickd] could not open or seed the database', error);
    return { status: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}
