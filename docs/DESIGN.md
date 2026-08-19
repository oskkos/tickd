# tickd — design

Visual identity and UI system. Companion to `CONCEPT.md`, which owns *what* the app does and *why*.

**Boundary:** `CONCEPT.md` owns the flow — two taps, grade grid, no route name field, segment-never-
exclude analytics. This document owns how that flow looks. Cross-reference rather than restate, so
the two don't drift apart.

Status: first draft. Logo, icon set and fonts are production assets; UI stack chosen; screen-level
visual details open.
Last updated: 2026-08-19

---

## 1. Logo

A lowercase **k** in slate grey, with a climber silhouette reaching past it for two pale holds,
optionally over the wordmark **tickd**.

`tickd.png` (1024×1024) remains in the repo root as the original presentation lockup. It is **not** a
production asset and nothing references it.

### The asset set

Vector sources live in `apps/web/src/assets/brand/`; rendered icons in `apps/web/public/`. Both are
catalogued in `ICONS.md`, which owns the operational detail — this section owns the intent.

| Asset | Format | Notes |
|---|---|---|
| Mark | SVG | `k` + climber, no wordmark. `viewBox="0 0 360 498"`, so it is not square. |
| Inline lockup | SVG | Mark beside wordmark. For README, headers, a future login screen. |
| Stacked lockup | SVG | Mark above wordmark. Splash and marketing. |
| App icon | PNG 192, 512 | From the **stacked lockup** — see the exception below. |
| Maskable icon | PNG 512 | From the mark. Android crops to circle/squircle — artwork sits inside the centre **80%** safe zone, background bled to the edges. |
| `apple-touch-icon` | PNG 180 | From the mark. iOS ignores the manifest and doesn't round a transparent PNG, so the background is opaque. |
| Favicon | SVG | From the mark, on a dark rounded square. |

Every SVG ships in two variants. **The unsuffixed file is the dark-theme one** — `dim` is the default
and dark is not optional in a gym, so the default theme is the unqualified one; `-light` means *for
light backgrounds*. Fills are hardcoded, not `currentColor`, so a theme switch swaps files rather than
recolouring one.

### The two contrast problems, solved

**The climber disappears in dark mode.** Solved by inverting it to off-white (`#EDF2F3`) in the dark
variant, decided deliberately rather than shipping a washed-out auto-inversion.

**Black-on-slate is low contrast at small sizes.** Solved by the same inversion: off-white on the
`#6E8085` slate `k` separates cleanly at 48 px, where black-on-slate merged into one blob.

### One problem still open

**The `k` is doing unexplained work.** It's presumably lifted from ti-**ck**-d, but that isn't
obvious — it could equally read as *kiipeily* or *klättring*. Not a problem to fix, just worth being
deliberate about, since it's the shape that represents the app at 48 px with no wordmark to explain it.

### The wordmark exception

The rule is that an icon carries no wordmark, because the lockup is unreadable below ~120 px. **The
manifest `any` icons break it deliberately**: `icon-192.png` and `icon-512.png` include the wordmark,
while the maskable and `apple-touch` icons — the two actually rendered small — do not.

The trade-off is accepted, not overlooked: `any` icons appear in the install dialog and splash at large
sizes, where the wordmark earns its place. The cost is that at 48 px it degrades to a smudge, and the
four PNGs are not consistent with each other. If the launcher icon ever looks muddy, re-render the two
`any` icons from the mark; nothing else in the system depends on their contents.

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

**Font `6A` and French `6a` differ only by letter case**, and they are different scales representing
very different difficulties. Case is what tells them apart — it is data, not styling.

Note that case does *not* tell you the discipline: French serves rope everywhere and boulders at
Tampere, so a lowercase grade may be either (`CONCEPT.md` §7.3, D17). Case identifies the *scale*, and
that is precisely why transforming it corrupts the record.

Therefore:

- **Never apply `text-transform: uppercase`, `lowercase` or `capitalize` to `grade_raw`.** Ever. A
  stray uppercase utility class on a heading style would silently redisplay every French grade as a
  Font one — a harder grade, on a scale the climb was never graded with.
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

### Themes: daisyUI `dim` (dark) and `winter` (light)

**Adopt daisyUI's built-in themes rather than building a palette from scratch.** A palette needs
light/dark × base-100/200/300 × `-content` pairs × five semantic colours — roughly 30 values with
contrast relationships between them. daisyUI's are already contrast-checked.

**Dark: `dim`.** The lowest-chroma theme in daisyUI's dark set. Three reasons specific to this app:

- **Grade cells read as neutral text**, which is the one thing that must not be compromised. A
  low-chroma background delivers that.
- **Not pure black** — avoids OLED smearing while scrolling, and the base-100/200/300 steps give
  elevation for free.
- **Its muted primary leaves the semantic colour space free** for send / attempt / flash /
  sync-pending (below). A loud theme primary would compete with those.

**Light: `winter`.** Cool and low-chroma, same family as `dim`. (`night` is the fallback dark if
`dim` feels too flat; daisyUI's own examples pair `winter` with `night`.)

**Rejected: `synthwave` + `garden`.** Recorded because it was the initial instinct:

- They're two unrelated palettes. Light and dark should be one brand in two lighting conditions, not
  two brands — the primary hue would jump on toggle.
- High saturation in dim gym lighting causes halation, worst on a deep purple base at low
  brightness on OLED.
- Neon pink and cyan around the grade grid is chromatic noise exactly where precision matters.
- Colour must not compete with circuit semantics (below), and synthwave is maximally colourful.
- Pink on deep purple likely fails WCAG AA for body text.

**If more personality than `dim` is wanted, `dracula` is the compromise** — synthwave's purple/pink
family at a fraction of the saturation. Keeps the feel without the legibility cost.

**Tuning later, not now.** The logo hexes are known (below), so this is a matter of overriding two or
three values and letting the rest inherit — but it wants real UI to judge against:

```css
@plugin "daisyui/theme" { name: "dim"; --color-primary: <slate>; }
```

Extra themes can also simply be enabled — the token-based approach supports many, so `synthwave`
could ship as an opt-in without affecting the default experience.

### Brand palette, read from the logo

**Exact, not estimated** — these are the literal fill values in `src/assets/brand/`, which carries
only two fills per lockup plus the icon background.

| Token | Value | Source |
|---|---|---|
| `--ink` | `#14181A` | Wordmark and climber, **light** variant |
| `--paper` | `#EDF2F3` | Wordmark and climber, **dark** variant |
| `--slate` | `#6E8085` | The `k`, dark variant. Slightly blue-grey. The primary brand colour. |
| `--slate-light` | `#9AA9AD` | The `k`, light variant |
| `--surface` | `#15191A` | Icon and favicon background |

`--slate` is the one distinctive colour here and should carry the brand.

**The pale holds no longer have a colour.** In the original `tickd.png` they were a third value; in the
production vectors they are merged into the climber path and take its fill. Anything that wanted a
`--hold` accent needs to pick one rather than sample it.

**A seam worth knowing about:** the manifest's `background_color`/`theme_color` is `#1c212b` (daisyUI
`dim`), while the icon background is `#15191A`. On the Android splash the icon sits on the manifest
colour, so the two near-blacks meet — one slightly blue, one slightly green. Harmless, but if the
splash ever looks like the icon has a faint panel behind it, this is why.

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

**Mockups live in `apps/web/src/assets/ui-mocks/`** — seven screens, numbered in flow order:
logging, tick sheet, session start, flash rate, flash rate on day one, history, settings. They are
reference images rather than a specification: where a mock and this document disagree, this document
wins, because the mocks predate several decisions recorded here.

**`7-settings.png` is the clearest case, and three of its rows are deliberately unbuilt.** Stated here
so the mock is not read as a backlog:

- **Grade grid runs — "Easiest at top."** Settled below, and `packages/grade-spec` stores labels
  easiest-first so the grid renders storage order. A control would re-open a closed decision per user.
- **Send style.** The mock renders this toggle disabled and explains why; that explanation became the
  model (D20). `send_style` is derived, so there is nothing to set.
- **Defaults — Protection.** Obsoleted by the logging screen, which seeds discipline and protection from
  the session's own newest tick. A preference would govern only the first go of a session, and the better
  fix — seeding that first go from the last go anywhere — needs no setting at all.

The mock is also missing the import button, which §7.6 of `CONCEPT.md` added later, and its data panel
asserts *"storage is persisted"* as static copy where the built screen reports the three real states,
because the advice differs by state (D24).

### The grade grid

French 4→9c is **27 values**; Font 4→9A is **23**. Neither fits on a phone at a 56 px target size.
Both counts are restatements — `packages/grade-spec` holds the authoritative lists, and `CONCEPT.md`
§7.3 explains why the two scales must never share an ordinal namespace.

On a 390 px viewport with 16 px margins, 3 columns at an 8 px gap gives ~114 px wide cells — very
comfortable. About six rows are visible without scrolling, so ~18 grades.

**Default to your working range, not the whole scale.** Show roughly `[min − 2 … max + 2]` of your
last 90 days of ticks, with a "show all" expansion. Almost everyone climbs within a five-or-six-grade
band, so this makes the common case zero-scroll while keeping 9c reachable.

**Grade order runs top-down: easiest at the top.** Bottom-up would mirror a wall and a pyramid and is
the more thematically apt option, but the grid is a list of values and reads in the direction lists
read. The thematic payoff lands once, on first sight; the cost of an unexpected order is paid on every
use. `packages/grade-spec` stores labels easiest-first, so the grid renders them in storage order and
reversal is a UI concern that no longer arises.

### After the grade

`protection`, `send_style` and `prior_experience` (`CONCEPT.md` §7.4). Defaults do the work — `lead`,
plus a fixed `flash` and `prior_experience = none` — so the steady-state path really is grade →
confirm.

**The `send_style` default is fixed, not last-used.** Sticky defaults are fine for `protection`, where
a wrong value is visible on screen, but a sticky `redpoint` silently relabels every subsequent tick,
and that corrupts flash rate rather than merely being untidy (`CONCEPT.md` §4.2, D14).

**`prior_experience` needs permanent screen space, changeable in one tap** — never behind progressive
disclosure. A repeat mislabelled as a first encounter adds a phantom flash at an easy grade, so this
field earns room in a way `notes` and `rating` do not. Its three values are effectively the second tap
whenever the climb wasn't a flash.

No onsight option indoors (§6 of the concept). Boulder switches `protection` to `none` and hides
the control entirely.

### Undo

`CONCEPT.md` §3 calls undo first-class, because a two-tap UI maximises mis-taps.

Persistent, not a transient toast — a toast that vanishes after four seconds is useless when you
notice the mistake after your next climb. Suggestion: the last few ticks stay visible as a list on
the logging screen, each swipeable to delete. That serves as undo, confirmation, and session review
at once, with no extra screen.

Each row must show what was actually recorded — grade, `protection`, `send_style` and
`prior_experience` — not just the grade. Defaults do most of the logging, so the list is the only
place a wrong default becomes visible while you are still standing in front of the wall.

### Correcting a go

Undo is the tool at the wall; correction is the tool afterwards. The two are not alternatives — undo
removes a go from the middle of the evening, and re-logging it puts it back at the end, so a mis-tapped
grade fixed that way rewrites the sequence of the visit (`CONCEPT.md` D23).

**The tick sheet's first line is what was recorded, and each part of it is a target**: grade,
`protection`, outcome. Tapping one replaces the detail fields with that control; committing a value
returns to the fields. So the corrections sit **one tap deeper than the annotation controls** and the
two-tap logging path gains nothing — a climber with nothing to fix sees one line of text they already
wanted and no control they did not.

The values are worded exactly as the recent-ticks list and the session detail word them. A fourth
phrasing of "toprope" would be the drift that shared vocabulary exists to prevent.

**A boulder's protection is text, not a control.** `protection = 'none'` *means* boulder, so there is
no fourth value to offer — and the correction that would be needed instead crosses a discipline, which
takes the grade's notation with it and is deliberately not built.

**The correcting grade grid opens at the grade being corrected, and dims nothing.** The working range
answers "what will I climb next", which is the wrong question here: the answer is recorded already, and
a mis-tap is almost always adjacent to the cell that was meant. The current grade is marked with a fill
*and* an outline — §3's rule again, colour may not be the only signal.

### Empty states

Day one has no data at all, and the flash-rate view needs weeks of ticks before it says anything.
Empty states should explain what will appear and roughly when, rather than showing a chart axis with
nothing on it.

---

## 6. Component library: Tailwind + daisyUI + Base UI

**Decision: Tailwind CSS + daisyUI for appearance, Base UI for behaviour. From Phase 0. No MUI.**

Package name is **`@base-ui/react`**. The old `@base-ui-components/react` is deprecated, but nearly
every 2025 blog post and LLM-generated snippet still uses it — expect to correct that constantly.

MUI was the initial plan, alongside borrowing daisyUI's themes. Those two don't compose: MUI themes
are a **JS object** (`createTheme`, Emotion CSS-in-JS), daisyUI themes are **CSS custom properties**
(OKLCH in v5). Using MUI would mean hand-porting OKLCH values into a JS palette and re-deriving every
`-content` pairing — real work to produce a worse version of what daisyUI gives natively.

Reasons beyond the theming:

- **Phase 0 is almost entirely custom.** Logging screen, session list, venue picker, one chart,
  settings. MUI's value density is in complex forms and data tables, of which there are none here.
- **Bundle size is install size.** The service worker precaches everything before first use, so
  weight is paid up front. MUI + Emotion is substantially heavier than purged Tailwind.
- **Material's visual language fights the brand.** Poppins/Lato and a muted slate identity aren't
  Material; effort would go into suppressing ripples, elevation and MUI's type scale. Its default
  touch targets are also smaller than the 48–56 px specified in §4.

### Why a headless library at all

daisyUI is **CSS only**. Its `modal`, `dropdown` and `select` make things *look* right, but there's no
JavaScript — interactivity relies on the checkbox hack and `:focus-within`. What's missing is
behaviour: the laborious, invisible, accessibility-critical part.

- **Collision-aware positioning.** The strongest reason, ahead of accessibility. daisyUI's dropdown is
  CSS-positioned and will happily render off-screen — a real problem on a phone, near the bottom edge,
  in a thumb-reachable layout. Base UI bundles `@floating-ui/react-dom`.
- **Focus management.** On open, focus must move inside, stay trapped, and return to the trigger on
  close. CSS cannot do this; without it you tab straight into the page behind.
- **Dynamic ARIA** — `aria-expanded`, `aria-activedescendant`, `role="dialog"`. Static classes don't
  update with state.
- **Keyboard patterns** — arrows, Home/End, typeahead, Escape. Each specified in the ARIA Authoring
  Practices Guide, each fiddly.
- **Scroll locking** that doesn't make iOS Safari jump, and portals to escape `overflow: hidden`.

**From Phase 0 rather than later**, because retrofitting costs more than adopting. Building dialogs on
native `<dialog>` and swapping later means rewriting them; one pattern throughout is worth real money
on a solo project.

### Why Base UI specifically

**It's the same people.** The repo describes itself as "from the creators of Radix, Floating UI and
Material UI" — the original Radix engineers now build this at MUI. 1.0 shipped December 2025, current
is 1.6.0 (June 2026) with roughly monthly releases, and **shadcn/ui switched its default to Base UI in
July 2026**.

Three reasons that matter for this project:

- **Identical Tailwind ergonomics to Headless UI.** State is exposed as boolean data attributes, so
  you write bare variants (`data-open:`, `data-closed:`) rather than the verbose
  `data-[state=open]:` that Radix and Ark UI require. Enter/leave transitions use
  `data-starting-style` / `data-ending-style`, which means **no `<Transition>` wrapper component** —
  it's plain CSS, which suits Tailwind better.
- **Drawer is built in.** §4 requires thumb-reachable one-handed use and §5 specifies a bottom sheet
  for tick detail. Headless UI has no Drawer; you'd build it from `Dialog` yourself.
- **Per-component subpath exports** (`@base-ui/react/dialog`) give real tree-shaking, which matters
  when a service worker precaches the whole bundle before first use.

### The division of labour — one rule

**Base UI owns behaviour and structure. daisyUI owns appearance.**

This matters because the two overlap: daisyUI's `dropdown`, `modal`, `select` and `tabs` are CSS
implementations of the same components. Mixing them means fighting two state and positioning systems.

- Use daisyUI's **skin** classes: `btn`, `modal-box`, `menu`, `tabs`, `tab`, `toggle`, `select`,
  `card`, `input`.
- Avoid daisyUI's **behavioural** classes: `.dropdown`, `.modal`'s open-state classes, `.collapse`.
  Base UI owns that state.

### Two gotchas specific to this pairing

**Put `data-theme` on `<html>`, never on a subtree.** Dialogs, drawers and popovers render through a
portal, outside the React root — so a theme scoped to an inner element silently doesn't apply to them.
This is the trap in this exact stack.

**Package name is `@base-ui/react`**, not the deprecated `@base-ui-components/react`. See §6 opening.

### Expected usage

| Surface | Component |
|---|---|
| **Grade grid** | **Plain `<button>`s.** The one place a library is actively wrong — 27 buttons need no managed state, and there's no grid primitive anyway. |
| Tick-detail bottom sheet | `Drawer` |
| Confirm / delete | `Dialog` |
| Venue picker | `Combobox` (a filtered list in Phase 0 with two venues; grows into a real combobox) |
| Settings — theme, default `protection` | `Select`, `Switch` |
| `protection` / `send_style` | `RadioGroup`, or native radios in a `<fieldset>` — native is genuinely fine here and lighter |
| Boulder / rope toggle, analytics views | `Tabs` |
| Undo / sync feedback | `Toast` |

Enter/leave animation is CSS via `data-starting-style` / `data-ending-style` — no wrapper component.

**The one thing that would reverse the daisyUI decision:** if utility-class authoring is unpleasant to
work in. This project's largest risk is not finishing it, so day-to-day enjoyment is a legitimate
criterion, and MUI is a nicer daily experience for some people.

### Tokens

daisyUI already exposes theme values as CSS custom properties, so there's no separate token layer to
invent for colour. Add project-specific tokens (type scale, spacing, touch-target sizes) as custom
properties on `:root` alongside them.

Naming: `--{category}-{role}`, e.g. `--text-h2`, `--space-3`, `--tap-primary`.

If this grows, promote it to `packages/tokens/` in the monorepo alongside `grade-spec`
(`CONCEPT.md` §8.7). Not worth it yet.

---

## 7. Open questions

1. **daisyUI theme overrides** — the brand hexes are now exact (§3), but no `--color-primary` override
   has been applied to `dim` or `winter` yet. Worth doing once there is UI to judge it against.
2. **`protection` iconography** — lead / toprope / auto-belay need three glyphs that read at 24 px.
   Rope-and-quickdraw versus rope-over-anchor versus a coiled auto-belay? Needs sketching.
3. **What the `k` means** — see §1. Left open deliberately.

### Closed

- **~~Exact hex values~~** — read from the vectors rather than sampled by eye (§3).
- **~~Dark-mode logo treatment~~** — the climber is inverted to off-white; the `k` also lightens
  between variants (§1).
- **~~Grade grid direction~~** — easiest at the top.
- **~~Does the logo need an SVG redraw?~~** — done. `src/assets/brand/` is the vector source, and the
  small-size contrast was fixed in the same pass.

---

## 8. The flash-rate screen

**Numbered 8 rather than 6, where it belongs in the narrative.** §6 is cited eleven times from code
comments, `CLAUDE.md` and the capability specs; inserting a section ahead of it would move every one of
those. Section numbers here are keys for the same reason decision numbers are — see
`decision-log/README.md`. The screen is the fourth Phase 0 surface (`CONCEPT.md` §9.0) and reads best
after §5.

`CONCEPT.md` §4.2 owns *what* the metric is — flashes ÷ first encounters, including the encounters you
never sent (D14). This section owns how it is drawn, and almost every choice below exists to stop the
drawing claiming more than the counts support.

### The row, and why the track is a fixed width

```
   6a   ████████████████████░░░░░░░░░░   8/9
   6b   ██████████████┃░░░░░░░░░░░░░░░   7/11
   6c   ████████░░░░░░┃░░░░░░░░░░░░░░░   3/8
   7a   ░░░░░░░░░░░░░░┃░░░░░░░░░░░░░░░   0/6
        ┄┄┄┄┄┄ 7a+–7c+ · none yet ┄┄┄┄┄
   8a   ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┃┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈   1/1 · too few
        ↑ grade         ↑ ~50% rule       ↑ counts, always
```

`[ grade · fixed ][ track · flex ][ counts · fixed ]`, easiest grade at the top — the direction §5
settled for the grade grid, so the two surfaces read the same way down.

**The track is a fixed width, and that is what makes the screen readable.** Because every row's track
spans the same distance, one x-position means 50% for the whole chart, so a single vertical rule can be
drawn and the reader finds their level by scanning for the row whose fill stops reaching it. That scan
*is* the product: §4.2's claim is that the grade where your flash rate crosses ~50% is your real level.

The alternative is worth recording because it is genuinely attractive: scale each track's *length* to its
denominator and its fill to the numerator, and a `1/1` becomes a one-unit stub — small samples limit
themselves with no threshold, no colour trick and no statistics. It loses because every row would then be
a different length, so no x-position means 50%, the rule cannot be drawn at all, and the reader is left
comparing fill *fractions* across differently-sized bars. It fixes the overstatement by removing the
thing the screen is for.

**The counts are always shown**, in tabular figures, per §2. They are what lets the reader judge a thin
cell themselves, which is the job the next two rules decline to do for them.

### Three row states, none of them a colour

| Counts | Track | Fill | Says |
|---|---|---|---|
| `8/9` | solid | proportional | a measured rate |
| `0/6` | solid | present, zero width | six first encounters, none flashed — **a measurement** |
| `1/1` | dashed | **absent**, plus the word *too few* | too small a sample to place against the rule (D26) |

The middle row is the subtle one. `0/6` and a grade never met must not look alike: one says *you have met
this grade six times and never flashed it*, the other says *you have not met this grade*. The second is
`0/0`, which is not a rate at all and is never drawn as one — it appears only inside a gap row.

None of the three is distinguished by hue. §3 forbids colour as the only signal twice over, and in a gym
colour already means *circuit*, so the signals are the fill's presence, the track's treatment, and words —
including in the accessible name, since a missing bar is exactly what a non-visual reader cannot observe.

### The gap row

A run of grades inside the span with no first encounter collapses into one row naming the range it
covers. Both halves earn their place: listing only the grades you have met puts 6a beside 6c and makes the
curve read steeper than it is, while a row per unmet grade leaves the height unbounded — one curious go on
8a adds a row for every grade below it, the same outlier sensitivity §5's working range records.

There is **no threshold**: a run of one names its single grade. `0/0` is not a rate, so an unmet grade
could never have been an ordinary row, and the choice was only ever between two shapes of gap row. It
carries no track, so it cannot be mistaken for a bar of length zero.

### The pane selector, and what it refuses to hide

One pane per `protection`, carrying only the protections that have a first encounter — absent rather than
disabled, which is the argument §6's tab bar makes one level up: a disabled entry says the surface exists
and is being withheld. With one qualifying protection there is no selector, because a control that never
varies is noise. `none` reads as **Boulder**, since that is what it means (`CONCEPT.md` §7.4).

Segmenting is not tidiness. Pooling a toprope flash with a lead flash at one grade raises the curve
exactly where the crossing is read, so it would break the metric rather than blur it. Auto-belay gets its
own pane and will be a near-flat line at 100% — useless as a curve, and correct as a refusal to discount
your laps (D6).

Within a pane, **one chart per grade scale, each naming its scale even when it is the only one.** This
deliberately diverges from the session list, which drops a heading that never varies: there the grades sit
inside a visit that supplies the context, and here the grade column *is* the axis with nothing else to say
whether `6A` is Font or `6a` is French.

### Two things the mock shows that must not be built

`4-flash-rate.png` carries both, and both are forbidden:

- **A headline card — "You cross 50% at 6b+".** §4.2 shows the raw counts precisely so the reader finds
  the crossing themselves rather than being handed a grade. At these sample sizes a headline would state a
  conclusion with more confidence than the data supports, so it is specified as absent rather than merely
  left out.
- **Colour-graded bars.** §3, twice: colour already means circuit, and hue may not carry a signal alone.

The mock predates both rules. It is kept as a layout reference, not as a specification of what to draw.

### Empty state

Prose, per §5's empty-states rule, which was written about this screen: it needs weeks of ticks before it
says anything, so an axis with nothing on it reads as a broken chart rather than a young logbook. The
condition is *no first encounters* rather than *no ticks* — a logbook of only repeats has nothing to
divide.

---

## Reference: headless library comparison

Verified July 2026. Kept because the maintenance findings are the kind of thing that goes stale and is
worth re-checking rather than re-researching from scratch.

| Library | Version / health | Coverage for this project | Tailwind ergonomics |
|---|---|---|---|
| **Base UI** — chosen | 1.6.0 (Jun 2026), 1.0 Dec 2025, ~monthly releases, ~6M weekly downloads | Complete, plus **Drawer**, Autocomplete, Toast | `data-open` as a bare variant; `data-starting-style` for transitions |
| **Ark UI** | 5.37.2, frequent releases, only ~13 open issues — best maintenance signal | Complete, plus Drawer, ~55 components | Verbose `data-[state=open]:` |
| **Headless UI** | 2.2.10, but **patch-only for 21 months** | Complete for this list exactly, no Drawer | `data-open` — best, tied with Base UI |
| **Radix Primitives** | Stewardship moved to WorkOS; meta package stuck since Aug 2025 | **No Combobox** (open since 2022) | Verbose `data-[state=open]:` |
| **React Aria Components** | 1.19.0, active | Complete | Official plugin; render-prop style |

### Why Headless UI was dropped after initially being chosen

It was the first choice, on the reasonable grounds that daisyUI officially documents the pairing and
it has the best Tailwind ergonomics. The comparison then surfaced the problem: **the last feature
release was 2.2.0 in October 2024**, followed by 21 months of patch-only releases. The gap from 2.2.9
(September 2025) to 2.2.10 (April 2026) contained the *only* release in about ten months, and it was
two bugfixes. Maintainers state there is no roadmap — components ship when Tailwind Plus needs them —
and the Vue package is effectively abandoned.

Not broken, and arguably still fine given that its component set covers this project exactly. But Base
UI offers the same Tailwind ergonomics, a Drawer, better tree-shaking and active development, so
there's nothing to trade away.

### Also considered

- **React Aria Components** has the best touch, screen-reader and internationalisation story of the
  group — worth revisiting if accessibility becomes a priority. It's a single flat package pulling
  `react-aria`, `react-stately` and `@internationalized/date`, so it's unambiguously the heaviest,
  which is the wrong trade for a precached PWA.
- **Ariakit** is a mature React-only option with a strong Combobox, but the smallest ecosystem.
- **shadcn/ui** is not a headless library — it's styled components built on Base UI (as of July 2026;
  previously Radix). It would compete with daisyUI rather than complement it.

Bundle-size figures for these libraries are mostly undocumented; treat any number found in listicles
as directional only.
