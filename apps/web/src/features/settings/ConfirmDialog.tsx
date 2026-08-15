import { AlertDialog } from '@base-ui/react/alert-dialog';

/**
 * The confirmation both destructive actions share.
 *
 * **Base UI's `AlertDialog`, and the first use of the dependency in this app.** The go sheet is
 * hand-rolled because it is a sheet whose dismissal rules are its own; this is the case the library
 * exists for — a modal that must trap focus, must not close on an outside tap, and must announce itself.
 * `DESIGN.md` §6 names `Dialog` for exactly this row of its usage table.
 *
 * **None of daisyUI's modal classes.** Its popup skin ships at `opacity: 0` and is revealed only through
 * a `.modal` parent's open state, which Base UI deliberately does not provide — so a popup wearing it is
 * invisible with a working backdrop, a rendering bug that reads as a CSS one. `App.test.tsx` scans the
 * source for the class name, which is why it is not spelled out here. Styling is plain utilities over
 * daisyUI's theme tokens.
 *
 * **Both actions are offered, and the safe one is offered first.** `onExportFirst` is not a courtesy:
 * a replace and a wipe have no undo except a file taken beforehand, and this app's position is that undo
 * is persistent and visible rather than a transient toast. Putting the export inside the confirmation is
 * the closest thing to an undo either operation can have.
 *
 * There is deliberately **no type-to-confirm gate**. The app is used one-handed, with chalky fingers, on
 * a 6.9" screen; a typed phrase is a worse experience than the risk it mitigates.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  onConfirm,
  onExportFirst,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What will happen, in counts that have already been verified. */
  body: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onExportFirst: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-30 bg-base-300/70" />
        <AlertDialog.Popup className="rounded-box fixed inset-x-4 bottom-4 z-40 bg-base-100 p-4 text-base-content shadow-xl">
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description
            render={<div className="mt-2 flex flex-col gap-2 text-sm opacity-80" />}
          >
            {body}
          </AlertDialog.Description>

          <div className="mt-4 flex flex-col gap-2">
            {/* The safe action first, and above the destructive one: the thumb reaches the lower
                controls first, so the irreversible one is the furthest from a habitual tap. */}
            <button
              type="button"
              onClick={onExportFirst}
              className="btn btn-outline min-h-touch w-full"
            >
              Export first
            </button>
            <div className="flex gap-2">
              <AlertDialog.Close className="btn btn-ghost min-h-touch flex-1">
                Cancel
              </AlertDialog.Close>
              <button
                type="button"
                onClick={onConfirm}
                className="btn btn-error min-h-touch flex-1"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
