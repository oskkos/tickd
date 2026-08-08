import type { PriorExperience, TickOutcome } from '../../db/types.ts';

/**
 * The outcome control: `prior_experience` × `is_send`, six cells, **all six valid**.
 *
 * This is the state space, not a validator. §7.4 named two invalid combinations and `CLAUDE.md`
 * required the UI to make them unreachable — after D20 they are unrepresentable, so there is no flash
 * button to disable and no cascade to police. A disabled control would imply the state exists and is
 * forbidden; no control implies it was never a state.
 *
 * **Nothing is preselected and nothing carries forward.** A tick is one go, so `none` would be
 * correct on the first go and wrong on every go after — and being wrong manufactures first encounters
 * that inflate flash rate's denominator. `DESIGN.md` makes the same argument against a sticky style: a
 * default that is wrong most of the time is worse than none, because it is wrong silently.
 *
 * **The cell commits.** There is no confirm step: an uncommitted tick is a tick you can lose, and §4
 * requires every tap to persist immediately because sessions are logged in fragments. Mis-taps are
 * undo's job (§3), and a confirm would charge every log to solve the same problem twice.
 */

const ROWS: readonly { readonly prior: PriorExperience; readonly label: string }[] = [
  { prior: 'none', label: 'First go' },
  { prior: 'attempted', label: 'Tried it' },
  { prior: 'sent', label: 'Sent it' },
];

/** The word for a cell. Only the first-go send has a name of its own — the rest are just outcomes. */
function cellLabel(prior: PriorExperience, isSend: boolean): string {
  if (!isSend) {
    return 'Fell';
  }
  // Derived, not chosen: sent with nothing before it can only be a flash (D20).
  return prior === 'none' ? 'Flash' : 'Sent';
}

export function OutcomeGrid({
  grade,
  onCommit,
}: {
  grade: string;
  onCommit: (outcome: TickOutcome) => void;
}) {
  return (
    <div>
      {/* Grade renders verbatim — case is what separates Font from French (DESIGN.md §2). */}
      <p className="tabular text-3xl" data-testid="outcome-grade">
        {grade}
      </p>

      <div role="group" aria-label="How did it go" className="mt-4 flex flex-col gap-2">
        {ROWS.map(({ prior, label }) => (
          <div key={prior} className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-sm opacity-70">{label}</span>
            {[false, true].map((isSend) => (
              <button
                key={String(isSend)}
                type="button"
                onClick={() => {
                  onCommit({ prior_experience: prior, is_send: isSend });
                }}
                aria-label={`${label}, ${cellLabel(prior, isSend).toLowerCase()}`}
                className="min-h-touch rounded-box flex-1 bg-base-200 text-base-content"
              >
                {cellLabel(prior, isSend)}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
