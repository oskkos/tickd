import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Prompt, never auto-reload.
 *
 * Sessions are logged in fragments and every tap persists immediately, so a reload the user did not
 * ask for is indistinguishable from data loss. The new service worker waits until they accept.
 *
 * **Positioned against `main`, not the viewport.** `fixed bottom-0` was correct while the shell ended in
 * `main`'s own padding; once a bottom tab bar arrived it put this card straight over the navigation —
 * 41px of a 57px bar, with both tabs failing a hit test. So the card is `absolute` and `main` is its
 * containing block: it can cover the bottom of the content, which is transient and dismissible, but it
 * can no longer reach the bar.
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
      // No safe-area margin any more: the tab bar sits below this and owns the bottom inset, so adding
      // one here would have lifted the card by an inset it is no longer adjacent to.
      className="card absolute inset-x-0 bottom-0 z-50 m-4 bg-base-200 shadow-lg"
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
