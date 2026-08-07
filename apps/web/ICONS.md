# Icons

The production icon set, generated from the vector brand assets in `src/assets/brand/`. These replaced
the mechanical placeholders derived from `tickd.png`, and they answer the three problems `DESIGN.md` §1
raised.

## What the source is

`src/assets/brand/` holds six SVGs — three lockups × two themes:

| File               | Contents             | Used for                                          |
| ------------------ | -------------------- | ------------------------------------------------- |
| `logo-mark.svg`    | `k` + climber        | The icon set. Non-square, `viewBox="0 0 360 498"` |
| `logo-inline.svg`  | mark beside wordmark | Headers, README, a future login screen            |
| `logo-stacked.svg` | mark above wordmark  | Splash and marketing                              |

Each has a `-light` sibling. **The unsuffixed file is the dark-theme asset** — `dim` is the default
theme and dark is not optional in a dimly lit gym (`DESIGN.md` §5), so the theme that ships by default
is the one without a qualifier. `-light` means _for light backgrounds_, not _a lighter drawing_.

The two variants differ **only in fill colours**, never in geometry:

| Element | Dark (`logo-mark.svg`) | Light (`logo-mark-light.svg`) |
| ------- | ---------------------- | ----------------------------- |
| Climber | `#EDF2F3` off-white    | `#14181A` near-black          |
| `k`     | `#6E8085` mid slate    | `#9AA9AD` light slate         |

Fills are hardcoded rather than `currentColor`, so switching themes means switching files — CSS cannot
recolour these. That is why both variants are committed.

## The three problems, resolved

1. **The climber disappears in dark mode** — solved by inverting it to off-white in the dark variant,
   which is the deliberate decision `DESIGN.md` §1 asked for rather than a washed-out auto-inversion.
2. **Black-on-slate is low contrast at small sizes** — solved by the same inversion. `#EDF2F3` on
   `#6E8085` separates cleanly at 48 px, where black-on-slate merged into one blob.
3. **No vector source existed** — solved. `favicon.svg` is now real paths rather than a wrapped raster,
   and the brand SVGs are the source every PNG is rendered from.

`DESIGN.md` §1's fourth observation — that the `k` does unexplained work — is a branding question, not
an asset problem, and is deliberately left open there.

## The shipped set

Everything below lives in `public/` and is referenced by `vite.config.ts` (manifest) or `index.html`.

| File                       | Size | Wordmark | Background            | Why                                                                                                  |
| -------------------------- | ---- | -------- | --------------------- | ---------------------------------------------------------------------------------------------------- |
| `icon-192.png`             | 192  | **yes**  | dark, rounded corners | Manifest `any`                                                                                       |
| `icon-512.png`             | 512  | **yes**  | dark, rounded corners | Manifest `any`                                                                                       |
| `icon-maskable-512.png`    | 512  | no       | `#15191A` to the edge | Android crops to a circle/squircle, so artwork stays inside the centre 80% and the background bleeds |
| `apple-touch-icon-180.png` | 180  | no       | `#15191A`, opaque     | iOS ignores the manifest and will not round a transparent PNG                                        |
| `favicon.svg`              | —    | no       | `#15191A`, `rx="12"`  | Vector, dark-only; a dark rounded square reads on either tab bar                                     |

### The wordmark is on the `any` icons only

This is a deliberate exception to `DESIGN.md` §1, which specifies the icon as mark-only because the
lockup is unreadable below ~120 px. The trade-off accepted here: the `any` icons are rendered large
(install dialog, splash, task switcher on a high-DPI phone) often enough to justify the wordmark, and
the two assets that _are_ shown small — maskable and apple-touch — omit it.

**The cost is real.** At 48 px `tickd` is an illegible smudge, and the four assets are not visually
consistent with each other. If the launcher icon ever looks muddy, this is the first thing to revisit:
re-render `icon-192`/`icon-512` from `logo-mark.svg` and nothing else changes.

## Verifying a replacement

Filenames are the contract — swapping artwork needs no code change as long as they match. Two
properties are not visible by eye and were measured, not assumed:

- **`icon-maskable-512.png`**: furthest artwork pixel is **182.6 px** from centre, against a **204.8 px**
  safe radius (80% of 512, halved). Under that number, no launcher mask clips the logo.
- **`apple-touch-icon-180.png`**: minimum alpha **255** across every pixel. A single transparent pixel
  and iOS renders it unrounded on a black square.

`icon-192`/`icon-512` are `any`, not maskable — their transparent rounded corners are correct and the
safe-zone rule does not apply to them.
