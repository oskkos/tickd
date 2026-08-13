import type { RopedProtection } from '../../db/types.ts';
import { ROPED_PROTECTIONS } from './disciplines.ts';

/**
 * How a roped climb was protected — `lead`, `toprope` or `autobelay`.
 *
 * **Three values, never four.** `none` *means* boulder (§7.4), so it is not a fourth way of being roped;
 * `RopedProtection` is what makes it unofferable rather than merely omitted from the list.
 *
 * Extracted from the logging screen once a second surface needed it. The go sheet corrects this field on a
 * written tick, and a second set of buttons there would be a second set of words and a second target size
 * for the same choice — on a control whose whole justification is that a wrong value is *visible*.
 *
 * Presentational only. The logging screen keeps its own rules about when the group renders — hidden
 * entirely for boulder, still live while a grade is pending, because realising it was toprope is a
 * correction to the go being logged. Those are decisions about a screen, not about a control.
 */
export function ProtectionGroup({
  value,
  onChange,
  label = 'Protection',
}: {
  value: RopedProtection;
  onChange: (protection: RopedProtection) => void;
  /** Distinguishes the two groups for assistive tech when a screen could show both. */
  label?: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 gap-2">
      {ROPED_PROTECTIONS.map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed={p === value}
          onClick={() => {
            onChange(p);
          }}
          className="min-h-touch rounded-box flex-1 bg-base-200 text-sm aria-pressed:bg-primary aria-pressed:text-primary-content"
        >
          {p}
        </button>
      ))}
    </div>
  );
}
