# tickd — design

Visual identity and UI system. Companion to `CONCEPT.md`, which owns *what* the app does and *why*.

**Boundary:** `CONCEPT.md` owns the flow — two taps, grade grid, no route name field, segment-never-
exclude analytics. This document owns how that flow looks. Cross-reference rather than restate, so
the two don't drift apart.

Status: first draft. Logo exists (`tickd.png`), fonts chosen, everything else open.
Last updated: 2026-07-31

---

## 1. Logo

Current asset: `tickd.png` (1024×1024, white background).

A lowercase **k** in slate grey, with a black climber silhouette reaching past it for two pale
holds, over the wordmark **tickd** in black.

### What's needed before it's usable

The PNG is a presentation lockup, not a production asset set.

| Asset | Format | Notes |
|---|---|---|
| Full lockup | SVG | Transparent background. For marketing, README, login screen. |
| Icon (no wordmark) | SVG | Just the `k` + climber. The lockup is unreadable below ~120 px. |
| App icon | PNG 192, 512 | From the icon, not the lockup. |
| Maskable icon | PNG 512 | Android crops to circle/squircle — artwork must sit inside the centre **80%** safe zone, with the background bled to the edges. |
| `apple-touch-icon` | PNG 180 | iOS ignores the manifest and doesn't apply rounding to a transparent PNG — needs an opaque background baked in. |
| Favicon | SVG + ICO 32 | At 16 px only the `k` silhouette will read. |
| Dark variant | SVG | See below. |

### Three problems to solve

**The climber disappears in dark mode.** A black silhouette on a dark background has no contrast.
The dark variant needs the climber inverted to off-white, or the `k` lightened enough to hold the
silhouette. Worth deciding deliberately rather than shipping a washed-out auto-inversion.

**Black-on-slate is low contrast at small sizes.** The silhouette against the grey `k` works at
poster scale; at 48 px they merge into one blob. The icon version likely needs the climber knocked
out in white, or a thin light outline.

**The `k` is doing unexplained work.** It's presumably lifted from ti-**ck**-d, but that isn't
obvious — it could equally read as *kiipeily* or *klättring*. Not a problem to fix, just worth being
deliberate about, since it's the shape that will represent the app at 48 px with no wordmark to
explain it.

---

## 2. Typography

**Headings: Poppins SemiBold (600). Body: Lato Regular (400).**

A geometric sans paired with a humanist one — good contrast in character without clashing. Poppins'
circular forms suit short, punchy labels; Lato is more comfortable at small sizes and in longer
running text like session notes.

### Self-hosting is mandatory

Two independent reasons point the same way:

1. **Offline-first.** The service worker must precache the fonts. A CDN font is unavailable in a gym
   basement with no signal.
2. **GDPR.** In 2022 the Munich regional court held that dynamically embedding Google Fonts breached
   the GDPR by transmitting visitors' IP addresses without consent.

So: `.woff2` files committed to the repo, subset to `latin` + `latin-ext` (the latter for ä/ö),
served from the same origin, `font-display: swap`, and preloaded.

Weights actually needed — keep this list short, since each file is precached:

| Family | Weight | Use |
|---|---|---|
| Poppins | 600 SemiBold | Headings, grade cells, numbers in stats |
| Lato | 400 Regular | Body, labels, notes |
| Lato | 700 Bold | Inline emphasis (add only if genuinely needed) |

Subset `.woff2` files run roughly 15–25 kB each, so two or three is comfortable for offline
precaching.

### Grade text must never be case-transformed

This is the one typography rule that is actually a *data* rule, and it falls directly out of
`CONCEPT.md` §7.3.

**Font `6A` and French `6a` differ only by letter case.** Uppercase means a boulder problem;
lowercase means a rope route; they represent very different difficulties.

Therefore:

- **Never apply `text-transform: uppercase`, `lowercase` or `capitalize` to `grade_raw`.** Ever. A
  stray uppercase utility class on a heading style would silently turn every rope grade into a
  boulder grade on screen.
- Grade values render verbatim from the database.
- Avoid all-caps styling anywhere near grades, so nobody is tempted.
- Worth an ESLint or stylelint rule, and worth asserting in a component test.

Poppins distinguishes `A` from `a` clearly (single-storey but unambiguous), so the distinction reads
fine as long as nothing transforms it.

### Numerals

Grade cells and stats are full of digits that should line up in columns. Use **tabular figures**
(`font-variant-numeric: tabular-nums`) for the pyramid, flash-rate table and any numeric column.
Proportional figures are fine in running text.

### Scale

Modest scale, since the app has few text levels. Base 16 px, 1.25 ratio:

| Token | Size | Family | Use |
|---|---|---|---|
| `--text-display` | 32 px | Poppins 600 | Grade cell in the active/selected state |
| `--text-h1` | 25 px | Poppins 600 | Screen titles |
| `--text-h2` | 20 px | Poppins 600 | Section headings, grade cells |
| `--text-body` | 16 px | Lato 400 | Default |
| `--text-small` | 14 px | Lato 400 | Secondary labels, metadata |
| `--text-caption` | 12 px | Lato 400 | Timestamps, hints. Minimum size — nothing smaller. |

---

## 3. Colour

### Brand palette, sampled from the logo

**Estimated by eye — verify with a colour picker against `tickd.png` before committing.**

| Token | Approx. | Source |
|---|---|---|
| `--ink` | `#141414` | Wordmark and climber silhouette |
| `--slate` | `#404B4E` | The `k`. Slightly blue-grey. The primary brand colour. |
| `--hold` | `#C9CED1` | The two pale holds |
| `--paper` | `#FFFFFF` | Background |

`--slate` is the one distinctive colour here and should carry the brand. `--hold` is a natural
accent — it already means "the thing you're reaching for", which is a pleasingly apt association
for interactive targets.

### Dark mode is not optional

Climbing gyms are frequently dimly lit, and the phone comes out mid-session. Design dark first, or at
least alongside — not afterwards.

Avoid pure black backgrounds; a very dark slate reads better and reduces halation against light
text. Something in the `#16191A`–`#1C2123` range keeps the family relationship with `--slate`.

### Colour may not be the only signal — twice over

**Not for grades.** In a climbing gym, colour already means *circuit*. Encoding difficulty by colour
would collide with what users already read colour as — and Kiipeilyareena explicitly notes a 6A may
have pink holds and a 7B yellow ones (`CONCEPT.md` §7.3). Grades are identified by their text, full
stop.

**Not for `protection`.** Lead / toprope / auto-belay must be distinguishable by **icon or shape**,
not hue alone. This is the standard accessibility argument, plus the circuit-confusion one above.

### Semantic colours still needed

Not yet decided:

- Send versus attempt (`is_send`)
- Flash versus redpoint emphasis
- Destructive/undo
- Success, warning, offline-pending state

**One that matters more than it looks: the sync-pending indicator.** Offline logging is the core
promise, so "saved locally, not yet synced" must be visibly distinct from "synced" without being
alarming. It's a normal state, not an error.

---

## 4. Physical conditions drive the UI

Design constraints that come from where this app is used, not from taste:

- **Chalky, sweaty fingers reduce touch accuracy.** Go beyond the 44 px minimum — **48–56 px** for
  primary targets.
- **One-handed use.** You may be tied in, belaying, or holding a drink. Primary actions belong in
  the lower thumb-reachable third of the screen, not in a top navigation bar.
- **Dim light** — see dark mode above.
- **Interruption is constant.** Sessions are logged in fragments over two hours. Never rely on a
  multi-step flow completing; every tap should persist immediately.
- **Haptic feedback on a successful tick** is a cheap, satisfying confirmation — but note
  `navigator.vibrate` is unsupported in iOS Safari, so it must be a bonus rather than the only
  confirmation signal.

---

## 5. The logging screen

The most important screen in Phase 0, and the hardest layout problem.

### The grade grid

French 4→9c is **27 values**; Font 4→9A is **22**. Neither fits on a phone at a 56 px target size.

On a 390 px viewport with 16 px margins, 3 columns at an 8 px gap gives ~114 px wide cells — very
comfortable. About six rows are visible without scrolling, so ~18 grades.

**Default to your working range, not the whole scale.** Show roughly `[min − 2 … max + 2]` of your
last 90 days of ticks, with a "show all" expansion. Almost everyone climbs within a five-or-six-grade
band, so this makes the common case zero-scroll while keeping 9c reachable.

Open question: whether grade order runs bottom-up (easiest at the bottom, mirroring a wall and a
pyramid) or top-down (conventional reading order). Bottom-up is more thematically apt; top-down is
less surprising. Worth trying both.

### After the grade

`protection` and `send_style` (`CONCEPT.md` §7.4). Defaults do the work: `lead` and the last-used
`send_style`, so the steady-state path really is grade → confirm.

No onsight option indoors (§6 of the concept). Boulder switches `protection` to `none` and hides
the control entirely.

### Undo

`CONCEPT.md` §3 calls undo first-class, because a two-tap UI maximises mis-taps.

Persistent, not a transient toast — a toast that vanishes after four seconds is useless when you
notice the mistake after your next climb. Suggestion: the last few ticks stay visible as a list on
the logging screen, each swipeable to delete. That serves as undo, confirmation, and session review
at once, with no extra screen.

### Empty states

Day one has no data at all, and the flash-rate view needs weeks of ticks before it says anything.
Empty states should explain what will appear and roughly when, rather than showing a chart axis with
nothing on it.

---

## 6. Tokens

Design values live as CSS custom properties on `:root`, overridden in a `[data-theme="dark"]` block.
Single source of truth, consumable by any component, and trivially themeable.

Naming: `--{category}-{role}`, e.g. `--color-bg-primary`, `--space-3`, `--text-h2`,
`--radius-card`.

If this grows, promote it to `packages/tokens/` in the monorepo alongside `grade-spec`
(`CONCEPT.md` §8.7) and generate the CSS from a spec file. Not worth it yet.

---

## 7. Open questions

1. **Exact hex values** — sample `tickd.png` with a picker; §3 is estimated by eye.
2. **Dark-mode logo treatment** — invert the climber, or lighten the `k`?
3. **Grade grid direction** — easiest at the bottom or the top?
4. **`protection` iconography** — lead / toprope / auto-belay need three glyphs that read at 24 px.
   Rope-and-quickdraw versus rope-over-anchor versus a coiled auto-belay? Needs sketching.
5. **Does the logo need an SVG redraw?** If `tickd.png` is raster-only with no vector source, the
   icon set will need redrawing regardless — which is also the moment to fix the small-size contrast.
