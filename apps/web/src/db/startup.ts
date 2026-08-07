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

/**
 * Prepares storage for reading.
 *
 * Never rejects. If IndexedDB is unavailable — Firefox private browsing throws on open, and quota
 * exhaustion can too — the app still has to render. A logbook that cannot save is bad; a white
 * screen is worse, and gives the user nothing to act on.
 */
export async function initialiseStorage(): Promise<void> {
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

  try {
    await seedVenues(db);
  } catch (error) {
    console.error('[tickd] could not open or seed the database', error);
  }
}
