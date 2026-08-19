import type { Protection } from '../../db/types.ts';
import { protectionTab } from './labels.ts';

/**
 * Which protection's charts are on screen.
 *
 * **The same segmented control as `ProtectionGroup`, deliberately down to the classes.** That is the
 * logging screen's protection control, and this is a second control over the same field on a second
 * surface — a climber who has learned that the filled one is the chosen one on the logging screen must
 * not have to learn a different signal here. It is not the same *component*, because `ProtectionGroup` is
 * typed `RopedProtection` and offers a fixed three: `none` is unofferable there, correctly, since it is
 * not a fourth way of being roped, and it is one of the four panes here (§7.4).
 *
 * **A `role="group"` of `aria-pressed` buttons rather than a tablist.** `ProtectionGroup` established the
 * pattern and it carries no ARIA the markup does not honour: a real tablist promises arrow-key traversal
 * and `aria-controls` wiring to a panel, which would be Base UI's `Tabs` and its behaviour to own. The
 * buttons say what they are and which one is pressed, which is the whole of what this control does.
 *
 * **Rendered by `entries`, never filtered here.** The caller decides membership, because the same list
 * decides which pane opens first (`panes.ts`) and two derivations of it could disagree about whether
 * toprope exists.
 *
 * Presentational, and read-only like the rest of this surface: it changes which numbers are shown and
 * writes nothing. Correction lives on the session detail (D23).
 */
export function ProtectionSelector({
  entries,
  value,
  onChange,
}: {
  /** The protections with a pane, in fixed order — see `protectionsPresent`. */
  entries: readonly Protection[];
  value: Protection;
  onChange: (protection: Protection) => void;
}) {
  // One pane needs no control. A selector with a single entry can only ever say what the chart heading
  // below it already says, and `SessionsScreen` made this call first about a group heading that never
  // varies. Note this is *no selector*, not a disabled one — the argument for absence in
  // `protectionsPresent` applies to the whole control as much as to one entry of it.
  if (entries.length <= 1) {
    return null;
  }

  return (
    <div role="group" aria-label="Protection" className="flex shrink-0 gap-2">
      {entries.map((protection) => (
        <button
          key={protection}
          type="button"
          aria-pressed={protection === value}
          onClick={() => {
            onChange(protection);
          }}
          className="min-h-touch rounded-box flex-1 bg-base-200 text-sm aria-pressed:bg-primary aria-pressed:text-primary-content"
        >
          {/* Capitalised in the label module, not by `capitalize`: this word is the button's accessible
              name as well as its glyph, and `none` must *read* as `Boulder` rather than merely look like
              it. */}
          {protectionTab(protection)}
        </button>
      ))}
    </div>
  );
}
