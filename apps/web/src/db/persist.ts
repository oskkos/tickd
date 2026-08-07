/**
 * Storage persistence.
 *
 * IndexedDB is evictable: both Safari and Chrome clear site data under storage pressure, and iOS
 * Safari clears unused site data for non-installed PWAs. A persisted origin is exempt from
 * best-effort eviction, which is one line of code and therefore worth having (`CONCEPT.md` §7.6).
 *
 * **This is not a backup and does not pretend to be.** Phase 0 has none, deliberately — the trial is
 * about a month long and a month of ticks is re-enterable from memory. Manual JSON export/import is
 * the restore path; sync is Phase 1's answer.
 *
 * **Chromium only.** Safari does not implement `persist()`, so absence is an expected outcome rather
 * than an error. On iOS the protection is instead that home-screen-installed PWAs escape the 7-day
 * unused-data clear. The Phase 0 trial device is Android (§9.0), so this does real work.
 */

/** What happened, so a caller can log it without re-deriving the reasons. */
export type PersistOutcome = 'persisted' | 'denied' | 'unsupported' | 'errored';

/**
 * Requests persistent storage, once, and never throws.
 *
 * Measured under jsdom: `navigator.storage` is itself undefined there, not merely its `persist`
 * method — so the guard chains at both levels rather than assuming the container exists.
 */
export async function requestPersistence(): Promise<PersistOutcome> {
  // The DOM lib declares `navigator.storage` as always present and `persist` as always callable.
  // Both overstate reality — jsdom defines no `storage` object at all, and Safari ships one without
  // `persist`. Widening the type here is what makes the guard below legitimate rather than dead code
  // the linter would strip.
  // `Omit` rather than `&`: intersecting with an optional property does not make the required one
  // optional, so `Navigator & { storage?: ... }` still types `storage` as always present.
  const { storage } = globalThis.navigator as Omit<Navigator, 'storage'> & {
    storage?: StorageManager;
  };
  if (typeof storage?.persist !== 'function') {
    return 'unsupported';
  }

  try {
    return (await storage.persist()) ? 'persisted' : 'denied';
  } catch {
    // A refusal is not fatal. Phase 0 accepts evictable storage as a stated trade-off, so failing
    // startup here would trade a small risk for a certain outage.
    return 'errored';
  }
}
