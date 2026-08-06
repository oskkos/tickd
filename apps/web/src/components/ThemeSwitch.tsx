import { useState } from 'react';

type Theme = 'dim' | 'winter';

/**
 * Temporary. Where the theme control lives — and whether the choice persists — is a settings-screen
 * concern (mockup 7). This exists so the scaffold can prove both themes render, including inside
 * portalled content.
 *
 * `data-theme` is written to <html>, never to a subtree: Base UI portals escape the React root.
 */
export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme | undefined) ?? 'dim',
  );

  function toggle() {
    const next: Theme = theme === 'dim' ? 'winter' : 'dim';
    document.documentElement.dataset.theme = next;
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-ghost min-h-touch min-w-touch"
      aria-label={`Switch to ${theme === 'dim' ? 'light' : 'dark'} theme`}
    >
      {theme === 'dim' ? 'Light' : 'Dark'}
    </button>
  );
}
