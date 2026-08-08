import type { TickAnnotation } from '../../db/ticks.ts';
import type { HoldType, WallAngle } from '../../db/types.ts';

/**
 * Optional detail for a tick that already exists.
 *
 * Everything here is progressive disclosure and **never a required step** (§3). The tick was written
 * the moment the outcome was tapped, so this edits rather than completes it — which is why it can be
 * abandoned by walking away, and why it is reachable again later from the recent list.
 *
 * These fields are **descriptive, not analytic** (D21). A tick is one go while `angle` and `holds`
 * describe a climb, so a route worked over four goes carries them on whichever go was annotated —
 * systematically the send, since nobody annotates the fall they walked away from. Building a metric
 * on them would bias it; the session-scoped grouping that would fix that was deferred.
 */

const ANGLES: readonly WallAngle[] = ['slab', 'vertical', 'overhang', 'roof'];
const HOLDS: readonly HoldType[] = ['crimp', 'sloper', 'pinch', 'pocket', 'jug'];

export function AnnotationPanel({
  annotation,
  onChange,
}: {
  annotation: TickAnnotation;
  onChange: (next: TickAnnotation) => void;
}) {
  const holds = annotation.holds ?? [];

  return (
    <div className="flex flex-col gap-3">
      <fieldset>
        <legend className="text-xs uppercase tracking-wide opacity-60">Angle</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {ANGLES.map((angle) => (
            <button
              key={angle}
              type="button"
              aria-pressed={annotation.angle === angle}
              onClick={() => {
                // Tapping the selected one clears it — at most one, and none is valid.
                onChange({ ...annotation, angle: annotation.angle === angle ? undefined : angle });
              }}
              className="min-h-touch rounded-box bg-base-200 px-3 aria-pressed:bg-primary aria-pressed:text-primary-content"
            >
              {angle}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs uppercase tracking-wide opacity-60">Holds</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {HOLDS.map((hold) => {
            const on = holds.includes(hold);
            return (
              <button
                key={hold}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  // Several, because a route can be crimpy and slopey at once (D21).
                  onChange({
                    ...annotation,
                    holds: on ? holds.filter((h) => h !== hold) : [...holds, hold],
                  });
                }}
                className="min-h-touch rounded-box bg-base-200 px-3 aria-pressed:bg-primary aria-pressed:text-primary-content"
              >
                {hold}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide opacity-60">Notes</span>
        <textarea
          value={annotation.notes ?? ''}
          onChange={(e) => {
            onChange({ ...annotation, notes: e.target.value || undefined });
          }}
          rows={2}
          className="rounded-box bg-base-200 p-2 text-sm"
          placeholder="Anything worth remembering"
        />
      </label>
    </div>
  );
}
