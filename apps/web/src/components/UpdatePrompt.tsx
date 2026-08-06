import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Prompt, never auto-reload.
 *
 * Sessions are logged in fragments and every tap persists immediately, so a reload the user did not
 * ask for is indistinguishable from data loss. The new service worker waits until they accept.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) {
    return null;
  }

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 m-4 card bg-base-200 shadow-lg"
      // Sits above the thumb zone rather than inside it, so it cannot be dismissed by accident
      // mid-entry.
      style={{ marginBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
    >
      <div className="card-body gap-3 p-4">
        <p className="text-sm">A new version is ready.</p>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-primary min-h-touch flex-1"
            onClick={() => {
              void updateServiceWorker(true);
            }}
          >
            Reload
          </button>
          <button
            type="button"
            className="btn btn-ghost min-h-touch"
            onClick={() => {
              setNeedRefresh(false);
            }}
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
