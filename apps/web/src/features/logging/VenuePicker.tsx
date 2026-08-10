import type { Venue } from '../../db/types.ts';
import { disciplinesAt } from './disciplines.ts';

/**
 * Where are we — the screen that opens a session.
 *
 * **There is no location detection here, and the copy no longer implies one.** §3 keeps GPS as a
 * background hint for a later phase; Phase 0 ships none of it, so a line explaining that location is a
 * hint rather than a gate described a feature the app does not have. The preselection is the last
 * venue, which is right far more often than not, and every venue stays choosable regardless.
 *
 * Wall heights are not shown. §12 Q1 is still open and `default_route_length_m` is deliberately
 * unseeded — a guessed height would skew vertical metres silently, so absent is the honest state.
 */
export function VenuePicker({
  venues,
  selectedId,
  onSelect,
  onStart,
}: {
  venues: readonly Venue[];
  selectedId?: string | undefined;
  onSelect: (id: string) => void;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h2 className="text-2xl">Where are we</h2>
        <p className="text-sm opacity-70">Last time you were at the one that&rsquo;s selected.</p>
      </div>

      <ul aria-label="Venues" className="flex flex-col gap-2">
        {venues.map((venue) => {
          const offered = disciplinesAt(venue)
            .map((d) => d.label)
            .join(' · ');
          return (
            <li key={venue.id}>
              <button
                type="button"
                aria-pressed={venue.id === selectedId}
                onClick={() => {
                  onSelect(venue.id);
                }}
                className="min-h-touch rounded-box w-full bg-base-200 px-4 py-3 text-left aria-pressed:bg-primary aria-pressed:text-primary-content"
              >
                <span className="block">{venue.name}</span>
                <span className="block text-sm opacity-70">
                  {venue.city} · {offered}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Primary action in the lower thumb-reachable third — one-handed use is a requirement. */}
      <button
        type="button"
        onClick={onStart}
        disabled={selectedId === undefined}
        className="btn btn-primary min-h-touch-lg mt-auto w-full text-base"
      >
        Start session
      </button>
    </div>
  );
}
