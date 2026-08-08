import type { StorageStatus } from '../db/startup.ts';

/**
 * Tells the user when the logbook cannot save, instead of leaving them to infer it.
 *
 * Without this, a failed or hung IndexedDB open renders an empty venue picker that is
 * indistinguishable from a first launch — and the natural reading of an empty logbook is that the
 * data is gone. That is the worst available message, and it was the one the app sent (§7.6 accepts
 * losing data to eviction; it does not accept lying about it).
 *
 * The wording names the likely cause, because the two real ones are both user-fixable: private
 * browsing blocks IndexedDB outright, and a second tab can hold the connection open.
 */
export function StorageWarning({ status }: { status: StorageStatus }) {
  if (status === 'ready') {
    return null;
  }

  const message =
    status === 'unavailable'
      ? 'This browser will not let tickd store anything — private browsing blocks it. Nothing you log here will be saved.'
      : 'Storage did not open. Another tab may be holding it; close any other tickd tabs and reload.';

  return (
    <div
      role="alert"
      className="rounded-box border border-warning/40 bg-warning/15 px-4 py-3 text-sm text-base-content"
    >
      <p className="font-semibold">Not saving</p>
      <p className="opacity-80">{message}</p>
    </div>
  );
}
