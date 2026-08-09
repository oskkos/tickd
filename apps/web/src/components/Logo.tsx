import darkLogo from '../assets/brand/logo-inline.svg';
import lightLogo from '../assets/brand/logo-inline-light.svg';

/**
 * The wordmark, in whichever variant suits the active theme.
 *
 * The brand SVGs carry **hardcoded fills rather than `currentColor`** — the climber and the `k` are
 * two different colours, so one paintable path was never an option (`ICONS.md`). Switching themes
 * therefore means switching files, not recolouring one.
 *
 * The swap is CSS rather than React state. `data-theme` lives on `<html>` and is owned by
 * `ThemeSwitch`, so reading it in React would mean lifting that state or subscribing to a mutation
 * observer — for a logo. A descendant selector costs nothing and cannot fall out of step with the
 * attribute it keys on.
 *
 * Per `ICONS.md`, the unsuffixed file is the **dark** variant: `dim` ships by default and dark is not
 * optional in a gym, so the default theme is the unqualified one.
 *
 * Both files are fetched, roughly 5 kB each. Cheap, precached by the service worker, and the price of
 * not threading theme state through the component tree.
 */
export function Logo() {
  return (
    <>
      <img
        src={darkLogo}
        alt="tickd"
        className="h-7 w-auto [[data-theme='winter']_&]:hidden"
        data-testid="logo-dark"
      />
      <img
        src={lightLogo}
        alt="tickd"
        aria-hidden="true"
        className="hidden h-7 w-auto [[data-theme='winter']_&]:block"
        data-testid="logo-light"
      />
    </>
  );
}
