## Why

The trial is running and its data has no restore path. `CONCEPT.md` §7.6 accepts evictable storage on the
grounds that manual export and import exist as the bridge — and neither does. Every session logged until
they ship is unrecoverable if the browser evicts under pressure, if a schema change forces the
wipe-and-restart D7 relies on instead of migrations, or if the marker moves and an old export is refused.
On a phone running an installed PWA there is not even a DevTools path to start over.

Three smaller gaps close with it, all of them consequences of the same missing surface. `persist()` is
requested on every launch and its outcome goes to `console.info`, so a user whose browser refused
persistence is in a materially worse regime than §7.6 assumes and has no way to learn it — including no way
to learn that installing to the home screen is what usually fixes it. The theme resets to dark on every
launch, because `ThemeSwitch` is marked *Temporary* and explicitly owed to this screen. And `Settings` is
the fourth of the four Phase 0 surfaces `CONCEPT.md` §"Phase 0" names; only the flash-rate chart remains
after it.

## What Changes

- **A settings surface**, at `/settings`, reached from a third tab. It carries appearance, a data section
  and the destructive actions, in that order — the frequently used above the rarely used, and the
  irreversible last.
- **Export JSON.** One file: an envelope of `marker`, `exported_at` and `digest` around a payload of
  `venues`, `sessions` and `ticks`. Venues travel with the logbook even though they are seeded, because
  `bulkPut` seeding never deletes: an export from an older build keeps a since-dropped venue alive and its
  sessions resolvable.
- **Import JSON, replacing rather than merging** (§7.6). It refuses three ways, each with its own message:
  an unparseable file, a **marker mismatch** — refused, never upgraded, which is D7's substitute for
  migrations — and a **digest mismatch**, meaning the file has been edited since it was exported.
- **A digest, so a hand-edited file fails loudly instead of quietly.** The marker answers *"is this file
  from my schema?"*; it cannot answer *"is this file true to my schema?"*, because JSON can express rows the
  type system makes unrepresentable — a boulder carrying `protection: 'lead'` is marker-valid and corrupts
  the `(discipline, grade_scale)` key every metric groups by. Rather than validate field by field, the
  export carries a digest of its own payload and the import recomputes it. Any edit is refused; no
  per-field validation exists to drift from the row types. **It is FNV-1a, not SHA-256**, reusing the
  fingerprint the schema marker already computes: `crypto.subtle` is secure-context-only, the same trap
  `newId` documents, and a SHA-256 digest would throw on `http://192.168.x.x:5173` — the stated
  device-testing route — while working in production.
- **Delete my logbook**, which removes exactly what an export captures. Phase 0's answer to a schema change
  is wipe-and-restart, and on the trial device that currently requires DevTools the device does not have.
  Venues return on the next launch's seeding and preferences survive, because neither is your logbook; the
  dialog says so.
- **Both destructive paths confirm with counts they have already verified.** An import parses, checks the
  marker and checks the digest *before* any dialog appears, so the confirmation states what the file
  actually holds and what will be lost. Each offers exporting first — the only undo a replace or a wipe can
  have, and the app's stated position is that undo is persistent and visible rather than a transient toast.
  No type-to-confirm gate: chalky fingers, one-handed, 6.9" screen.
- **Storage state is reported, not acted on.** `initialiseStorage` already requests persistence on every
  launch, so a denial self-heals once the PWA is installed and Chromium's heuristic grants it; a retry
  button would repeat what the app did at boot. Settings reads the current state instead, and the three
  outcomes carry different advice — persisted, not persisted (install to the home screen), and unsupported
  (Safari, where staying on the home screen is what stops the 7-day clear).
- **Two preferences, in `localStorage`.** The theme, three-way with *follow system*, applied by an inline
  script before first paint — a React effect gives a flash of the wrong theme on every cold start, which in
  a dim gym is a flash of white. And a haptic on each tick, which `DESIGN.md` §4 wants and nothing yet
  implements, so this change adds the `navigator.vibrate` call in the tick write path as well as the toggle
  that governs it.
- **Preferences are device settings, not logbook data.** They live outside Dexie, outside the export, and
  outside the delete. That keeps the three tables at three, keeps the schema marker still, and makes
  "export then import on the new origin" carry a logbook rather than a device image.
- **`ThemeSwitch` leaves the header** for the settings screen it was always deferred to.

Deliberately absent, though `7-settings.png` shows all three: **grade grid order**, closed by `DESIGN.md`
§5 in favour of easiest-at-top, so a setting would reopen a settled decision; **send style**, which the mock
itself renders disabled and which D20 then removed from the model; and **default protection**, which
`LoggingScreen` has already obsoleted by seeding discipline and protection from the session's own newest
tick. A preference would govern only the first go of each session, and the better fix — seeding that first
go from the last go anywhere — needs no setting at all and is not attempted here.

Also not in scope: `navigator.storage.estimate()` figures, which name a quantity nobody can act on and
imply quota is the risk when eviction is; any automatic or scheduled export; and the flash-rate surface,
which is the next change.

## Capabilities

### New Capabilities

- `settings`: the surface and everything only it does — the export envelope and its digest, the import's
  three refusals and its replace-not-merge rule, the confirmation dialogs and their export-first
  affordance, the reported storage state, and the two preferences with their storage location and
  pre-paint application.

### Modified Capabilities

- `local-database`: gains the two whole-database write paths — an atomic replace across all three tables
  and an equivalent wipe, both all-or-nothing, neither a Dexie migration — beside the existing per-row write
  paths. Its "Storage persistence is requested best-effort" requirement gains the read half: the current
  state is queryable without requesting again, and `unsupported` is distinguishable from refused. The
  schema-marker requirement needs no change; it already anticipates this importer by name.
- `app-shell`: the tab bar requirement names `Log` and `Sessions` as the shipped tabs and says `Settings`
  will be added when its surface ships. It ships here. The theming requirement gains persistence and a
  follow-system option, and gains the rule that the stored choice is applied before first paint.

## Impact

**Code**

- `apps/web/src/features/settings/` — new: the screen, the export and import modules, the preference hooks.
- `apps/web/src/db/schema.ts` — `fingerprint` becomes exported, so the digest uses the same function as the
  marker rather than a copy of it.
- `apps/web/src/db/persist.ts` — gains the read path beside `requestPersistence`, so the jsdom guard chain
  and the persistence vocabulary stay in one module.
- `apps/web/src/db/` — a new module for the replace-all and delete-all transactions.
- `apps/web/src/router.tsx`, `components/TabBar.tsx` — one route, one tab, one icon.
- `apps/web/src/Shell.tsx`, `components/ThemeSwitch.tsx` — the theme control leaves the header.
- `apps/web/index.html` — the pre-paint theme script.
- `apps/web/src/features/logging/LoggingScreen.tsx` — the haptic on a written tick, gated by the preference.

**Verification**

- **The shell's geometry must be re-measured in a real browser at 412×600.** `ThemeSwitch` carries
  `min-h-touch` and is plausibly what sets the header's height, and `app-shell` pins the grade grid's floor
  with the tab bar present — a floor won by arguing over eight pixels in that same header. Removing the
  button probably gives the grid room, but "probably" is not how that scenario was established; jsdom
  reports every height as 0 and cannot tell the two apart.

**Not affected**

- No schema change, no new table, no new index, no Dexie version bump. The marker does not move, which is
  what lets an export taken before this change import after it.
- No new dependency. The digest, the file picker, the download and the preference store are all platform
  APIs.
- The logging path's writes are unchanged; only a vibration is added alongside one.
