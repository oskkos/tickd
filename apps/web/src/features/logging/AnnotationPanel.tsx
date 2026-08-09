import type { TickAnnotation } from '../../db/ticks.ts';
import type { GradeOpinion, HoldType, Rating, WallAngle } from '../../db/types.ts';

/**
 * Optional detail for a tick that already exists.
 *
 * Everything here is progressive disclosure and **never a required step** (§3). The tick was written
 * the moment the outcome was tapped, so this edits rather than completes it — which is why it can be
 * abandoned by walking away, and why it reopens later from the recent list.
 *
 * These fields are **descriptive, not analytic** (D21). A tick is one go while `angle` and `holds`
 * describe a climb, so a route worked over four goes carries them on whichever go was annotated —
 * systematically the send, since nobody annotates the fall they walked away from. Building a metric
 * on them would bias it; the session-scoped grouping that would fix that was deferred.
 *
 * Ordered by how much they cost to fill: taps first, keyboard last. On the fast path the sheet closes
 * itself long before anyone reaches the text fields, which is the intended outcome rather than a
 * shortcoming.
 */

const ANGLES: readonly WallAngle[] = ['slab', 'vertical', 'overhang', 'roof'];
const HOLDS: readonly HoldType[] = ['crimp', 'sloper', 'pinch', 'pocket', 'jug'];
const OPINIONS: readonly GradeOpinion[] = ['soft', 'fair', 'hard'];
const RATINGS: readonly Rating[] = [1, 2, 3, 4, 5];

/** One tappable value. Tapping the selected one clears it — none is always valid. */
function Chip({
  label,
  pressed,
  onClick,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="min-h-touch rounded-box bg-base-200 px-3 text-sm aria-pressed:bg-primary aria-pressed:text-primary-content"
    >
      {label}
    </button>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="text-xs uppercase tracking-wide opacity-60">{label}</legend>
      <div className="mt-1 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

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
      <Group label="Angle">
        {ANGLES.map((angle) => (
          <Chip
            key={angle}
            label={angle}
            pressed={annotation.angle === angle}
            onClick={() => {
              // At most one — wall angle is roughly exclusive, and it is the one that groups.
              onChange({ ...annotation, angle: annotation.angle === angle ? undefined : angle });
            }}
          />
        ))}
      </Group>

      <Group label="Holds">
        {HOLDS.map((hold) => (
          <Chip
            key={hold}
            label={hold}
            pressed={holds.includes(hold)}
            onClick={() => {
              // Several, because a route can be crimpy and slopey at once (D21).
              onChange({
                ...annotation,
                holds: holds.includes(hold) ? holds.filter((h) => h !== hold) : [...holds, hold],
              });
            }}
          />
        ))}
      </Group>

      {/* The setter's grade, judged. Not an alternative grade: `grade_raw` records what was on the
          tag, and §7.3 forbids overwriting what was entered with an interpretation of it. */}
      <Group label="Grade felt">
        {OPINIONS.map((opinion) => (
          <Chip
            key={opinion}
            label={opinion}
            pressed={annotation.grade_opinion === opinion}
            onClick={() => {
              onChange({
                ...annotation,
                grade_opinion: annotation.grade_opinion === opinion ? undefined : opinion,
              });
            }}
          />
        ))}
      </Group>

      {/* "This go was good" — with no route entity there is nothing to aggregate a rating *to*, so it
          cannot mean "this route is good" (§7.2, D2).

          Stars are cumulative: tapping the third lights one, two and three. Each remains its own
          button so the whole row stays reachable by keyboard and by screen reader, which a single
          slider or a row of radio inputs would not manage as cleanly at this size. */}
      <Group label="Rating">
        {RATINGS.map((rating) => {
          const lit = annotation.rating !== undefined && rating <= annotation.rating;
          return (
            <button
              key={rating}
              type="button"
              aria-pressed={lit}
              aria-label={`${String(rating)} star${rating === 1 ? '' : 's'}`}
              onClick={() => {
                onChange({
                  ...annotation,
                  rating: annotation.rating === rating ? undefined : rating,
                });
              }}
              className={[
                'min-h-touch w-10 text-2xl leading-none',
                lit ? 'text-warning' : 'text-base-content/25',
              ].join(' ')}
            >
              {/* Filled versus outlined rather than colour alone — colour may not be the only
                  signal (DESIGN.md §3). */}
              {lit ? '★' : '☆'}
            </button>
          );
        })}
      </Group>

      {/* Overrides the venue's wall height for this climb. Rarely needed, and currently overriding
          nothing — §12 Q1 is open, so no seeded venue carries a height yet. */}
      <label className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide opacity-60">Length</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={annotation.length_m ?? ''}
          onChange={(e) => {
            const parsed = Number.parseInt(e.target.value, 10);
            onChange({
              ...annotation,
              length_m: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
            });
          }}
          aria-label="Length in metres"
          className="rounded-box tabular w-20 bg-base-200 px-2 py-1 text-sm"
        />
        <span className="text-sm opacity-60">m</span>
      </label>

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
