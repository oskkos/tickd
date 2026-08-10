import { Link } from '@tanstack/react-router';

/**
 * Top-level navigation, along the bottom of the viewport.
 *
 * **Bottom rather than top**, because `DESIGN.md` §4 puts primary controls in the lower
 * thumb-reachable third: this app is used one-handed while tied in or holding a drink, and a top
 * navigation bar is the one place a thumb cannot go.
 *
 * **Only the tabs that exist.** `Flash` and `Settings` are Phase 0 surfaces that have not shipped, and
 * they are absent rather than disabled — a greyed-out tab says the surface exists and is being withheld,
 * which is a worse lie than saying nothing. Adding one is one entry in `TABS`.
 *
 * The active tab is marked three ways over: `aria-current`, a weight change, and an indicator rule
 * above it. `DESIGN.md` §3 requires colour never to be the only signal, and this bar is read at a
 * glance in a dim gym.
 */

/** A grid of cells — the logging screen is a grid of grades. */
function LogIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
      <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
    </svg>
  );
}

/** Stacked rules — a list of visits. */
function SessionsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
      <path d="M3 5h18v2.5H3zM3 10.75h18v2.5H3zM3 16.5h18V19H3z" />
    </svg>
  );
}

/**
 * The shipped surfaces, in flow order.
 *
 * **`Sessions` must stay inexact**, and that is the load-bearing half: it remains marked while a
 * session detail is open, because the detail is somewhere you went *from* the list rather than a fourth
 * place. Set it exact and the bar goes blank on the detail route.
 *
 * **`Log`'s `exact` is explicitness, not a fix.** It says "current only at `/`", which is what is meant,
 * but TanStack would already agree: its inexact match requires a whole path segment, so `/` does not
 * prefix-match `/sessions`. Checked in `link.js` rather than assumed — the plausible-sounding version
 * of this comment, that `exact` is what stops `/` matching everything, is false, and a test written to
 * prove it passes with the flag inverted.
 */
const TABS = [
  { to: '/', label: 'Log', Icon: LogIcon, exact: true },
  { to: '/sessions', label: 'Sessions', Icon: SessionsIcon, exact: false },
] as const;

export function TabBar() {
  return (
    // `shrink-0` so it takes its height out of `main` rather than overflowing a shell that is bounded
    // to the viewport. The grade grid inside `main` is what yields, and it has a floor.
    <nav
      aria-label="Sections"
      className="flex shrink-0 border-t border-base-300 bg-base-100"
      data-testid="tab-bar"
    >
      {TABS.map(({ to, label, Icon, exact }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact }}
          activeProps={{
            'aria-current': 'page',
            className: 'font-semibold text-primary',
          }}
          inactiveProps={{ className: 'text-base-content/60' }}
          className="min-h-touch group relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs"
        >
          {/* The indicator, drawn only for the current tab — `aria-current` is what selects it, so the
              mark and the semantics cannot disagree. */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 hidden h-0.5 bg-primary group-aria-[current=page]:block"
          />
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  );
}
