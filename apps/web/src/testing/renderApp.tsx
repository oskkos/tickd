import { render, screen } from '@testing-library/react';
import { App } from '../App.tsx';
import type { StartupResult } from '../db/startup.ts';

/**
 * Renders the app and waits for the router's first match to resolve.
 *
 * **The wait is not incidental.** `RouterProvider` renders nothing on its first pass and commits the
 * matched route in an effect, so a synchronous `getBy*` immediately after `render` sees an empty
 * `<div />`. That is production behaviour rather than a test artefact — the shell genuinely mounts a
 * tick later now — so the tests await it instead of the app pretending otherwise.
 *
 * `main` is the thing waited on because the shell owns it and every route renders inside it, so it is
 * present exactly when the frame is ready regardless of which surface was asked for.
 */
export async function renderApp(
  props: { startup?: StartupResult; initialPath?: string } = {},
): Promise<ReturnType<typeof render>> {
  const result = render(<App {...props} />);
  await screen.findByRole('main');
  return result;
}
