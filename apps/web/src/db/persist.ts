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

/**
 * What the settings screen reports: is the logbook protected *right now*.
 *
 * **Reading and requesting are deliberately separate calls, and this one never requests.** Requesting
 * is a startup concern and `initialiseStorage` does it on every launch, so a refusal retries itself
 * without anyone pressing anything — Chromium's heuristic grants persistence once the PWA is installed
 * to the home screen, and the app therefore self-heals. A "request again" button would repeat what boot
 * did moments earlier and imply the user's inaction was the problem.
 *
 * Reporting is the other question, and it needs an answer available at any moment rather than a
 * snapshot taken during boot. So this reads the current state instead of retaining `requestPersistence`'s
 * outcome — which also means settings needs to know nothing about the startup sequence.
 *
 * The three outcomes are distinguished because **the advice differs**, not for completeness:
 * `unpersisted` is fixed by installing to the home screen, and `unsupported` is Safari, where the
 * protection is instead that an installed PWA escapes the seven-day unused-data clear (§7.6). What is
 * *not* distinguished is refused-versus-never-asked: both produce the same advice, so the distinction
 * would be inert.
 *
 * It lives beside `requestPersistence` so the guard against an environment with no `navigator.storage`
 * at all — jsdom, and therefore every test — is written once.
 */
export type PersistState = 'persisted' | 'unpersisted' | 'unsupported' | 'unknown';

/** Reads the current persistence state. Never requests, never throws. */
export async function currentPersistence(): Promise<PersistState> {
  // Same widening as above, and for the same reason: the DOM lib says `navigator.storage` is always
  // there and `persisted` is always callable, and both overstate reality.
  const { storage } = globalThis.navigator as Omit<Navigator, 'storage'> & {
    storage?: StorageManager;
  };
  if (typeof storage?.persisted !== 'function') {
    return 'unsupported';
  }

  try {
    return (await storage.persisted()) ? 'persisted' : 'unpersisted';
  } catch {
    // Reporting cannot be allowed to break the screen that reports it.
    return 'unknown';
  }
}
