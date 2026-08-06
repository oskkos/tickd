# Icons — PLACEHOLDERS

**These are derived mechanically from `tickd.png` and are not the production icon set.**

`DESIGN.md` §1 is explicit that `tickd.png` is a presentation lockup rather than a production asset,
and that the icon set needs three things decided first:

1. **The climber disappears in dark mode.** A black silhouette on a dark background has no contrast.
   Needs the climber inverted to off-white, or the `k` lightened enough to hold it — decided
   deliberately, not auto-inverted.
2. **Black-on-slate is low contrast at small sizes.** At 48 px the silhouette and the grey `k` merge
   into one blob. Likely needs the climber knocked out in white, or a thin light outline.
3. **A vector source does not exist.** `DESIGN.md` §1 asks for SVG for the lockup, the icon and the
   dark variant. `favicon.svg` here wraps a raster because there is nothing to vectorise from.

## What was done

The wordmark was dropped — the lockup is unreadable below ~120 px — leaving the `k` + climber, padded
to square on the source's own near-white background.

| File                       | Size | Artwork coverage | Why                                                                                                                      |
| -------------------------- | ---- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `icon-192.png`             | 192  | 86%              | Manifest `any`                                                                                                           |
| `icon-512.png`             | 512  | 86%              | Manifest `any`                                                                                                           |
| `icon-maskable-512.png`    | 512  | **80%**          | Android crops to circle/squircle; artwork must sit inside the centre 80% safe zone with the background bled to the edges |
| `apple-touch-icon-180.png` | 180  | 86%              | Opaque background baked in — iOS ignores the manifest and will not round a transparent PNG                               |
| `favicon.svg`              | 128  | 100%             | Raster-in-SVG placeholder                                                                                                |

The geometry is correct and installability is satisfied. The _identity_ is not settled. Replacing
these needs no code change beyond matching filenames.
