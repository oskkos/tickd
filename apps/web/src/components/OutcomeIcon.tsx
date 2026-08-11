import type { GoOutcome } from '../db/style.ts';

/**
 * How a go ended, as a mark.
 *
 * **Its own module because three surfaces draw it** — the session summary and the history cards through
 * `GoPill`, and the session detail's rows directly. It started private to `GoPill`, and the detail rows
 * grew their own text glyphs (`⚡ ↑ ↓`) instead: the same three outcomes drawn two different ways, so a
 * send was a thumb on one screen and an arrow on the next. Shared, they cannot drift again.
 *
 * A flash gets its own shape rather than a variant of the send's. It is flash rate's numerator (§4.2,
 * D14), so flattening it into a send would make every display of a session disagree with the one metric
 * Phase 0 ships.
 *
 * Shape carries the meaning and colour only reinforces it: `DESIGN.md` §3 requires colour never to be
 * the only signal, and a session read at a glance in a dim gym is exactly where that matters.
 * `currentColor` throughout, so both themes are covered without a second asset.
 *
 * **Hidden from assistive tech**, so every caller must supply the word itself — `outcomeWord` in
 * `format/climbing.ts` is that word, whether as an accessible name on the pill or as `sr-only` text
 * beside the mark on a detail row.
 */
export function OutcomeIcon({ outcome }: { outcome: GoOutcome }) {
  if (outcome === 'flash') {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-4 w-4 text-warning"
        fill="currentColor"
      >
        <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
      </svg>
    );
  }

  const up = outcome === 'sent';
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`h-4 w-4 ${up ? 'text-success' : 'text-base-content/50'}`}
      style={up ? undefined : { transform: 'rotate(180deg)' }}
      fill="currentColor"
    >
      <path d="M2 10h4v11H2zM8 21h9.3a2 2 0 0 0 1.94-1.5l1.7-6.5A1.6 1.6 0 0 0 19.4 11H14l.9-4.3a2 2 0 0 0-3.4-1.8L8 9.4z" />
    </svg>
  );
}
