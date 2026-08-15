## Context

Three of the four Phase 0 surfaces exist. This is the fourth minus the flash-rate chart, and it is the one
carrying §7.6's durability story — a story currently written down and not implemented.

The ground is more prepared than it looks. `SCHEMA_MARKER` already exists in `db/schema.ts`, derived from
the store definitions plus an exhaustive `STORED_FIELDS` list and pinned by a test, with a header comment
saying it is there for this importer. `seedVenues` is already an idempotent `bulkPut` whose own comment
anticipates being re-run after "a JSON import replaces the database". `requestPersistence` already returns a
four-way outcome. Nothing in this change has to invent a marker, a seeding strategy or a persistence probe;
it has to use three that were built in advance.

The constraints that actually shape the work:

- **No `crypto.subtle`.** `newId` documents that `crypto.randomUUID` is secure-context-only and broke on
  `http://192.168.x.x:5173`, the stated device-testing route. `SubtleCrypto` carries the identical
  restriction.
- **No dexie-react-hooks anywhere.** Every screen loads via `useEffect` into `useState`. After a replace,
  every mounted screen holds rows that no longer exist.
- **No `localStorage` anywhere yet.** This change introduces the app's second persistence mechanism.
- **jsdom measures every height as zero**, so anything about the shell's geometry is settled in a real
  browser or not at all.

## Goals / Non-Goals

**Goals:**

- A restore path that works today, on a phone, from an installed PWA.
- Refusals that are unambiguous and that never half-apply.
- A hand-edited file fails loudly, without a second copy of the row invariants to drift from the first.
- Two preferences the trial actually wants, stored where they do not disturb the schema.
- Report the persistence regime the user is in, with the action that changes it.

**Non-Goals:**

- Merging, conflict resolution, or anything that resembles sync. Phase 1 owns identity (§8.3).
- Upgrading an old export. That is a Dexie migration by another name (D7).
- Field-by-field validation of an imported file. The digest replaces it, deliberately.
- Automatic or scheduled export. Pressing the button is on you — §7.6 says so.
- A preferences *system*. Two values, two keys, no abstraction.

## Decisions

### The envelope, and what the digest covers

```
{
  "marker":      "tickd.phase0-<fnv>",     ← from db/schema.ts, unchanged by this work
  "exported_at": "2026-08-15T10:38:00.000Z",
  "digest":      "<fnv>",                  ← over the payload only, never over itself
  "payload": { "venues": [...], "sessions": [...], "ticks": [...] }
}
```

The digest is computed over `JSON.stringify(payload)`, and import recomputes it from the **parsed** payload
rather than from a substring of the file text. That choice is what makes it whitespace-insensitive —
re-indenting or minifying a file changes the text and not the parse, so a prettified export still imports —
while staying sensitive to any changed value and to reordered keys. Hashing raw text would refuse a file
someone opened in an editor and saved with a trailing newline, which is a false alarm that teaches users to
distrust the check.

*Alternative considered:* a canonical serialisation with sorted keys. Rejected as unnecessary — both sides
of the comparison are produced by `JSON.stringify` over an object built the same way, and `JSON.parse`
preserves key order from the file. Sorting would add a canonicaliser to maintain in exchange for tolerating
an edit the check exists to catch.

### FNV-1a, not SHA-256

`db/schema.ts` already has `fingerprint()` — FNV-1a, 32-bit, non-cryptographic. Export it and reuse it.

A SHA-256 digest via `crypto.subtle` would be stronger against an adversary and would **throw on the dev
server over plain HTTP**, because `crypto.subtle` is secure-context-only. That is the same trap `newId`
documents having already been caught by, in the same file the digest would live next to. The threat model
here is a user who opened their export in a text editor, not one attacking themselves; 32 bits detects that
with room to spare.

### Import: validate, then confirm, then one transaction, then reload

```
choose file
   │
   ├─ unparseable ──────────▶ refuse: "This isn't a tickd export."
   ├─ marker ≠ build ───────▶ refuse: "…from a different version. Exports are not upgraded."
   ├─ digest ≠ payload ─────▶ refuse: "…modified since it was exported."
   │
   ▼
confirm, stating verified counts from both sides
   │
   ▼
db.transaction('rw', venues, sessions, ticks, …)   clear ×3 then bulkPut ×3
   │
   ▼
location.reload()
```

The refusals precede the dialog so the dialog can state numbers it has verified. Ordering them the other way
round produces the worst version of this screen: a confirmation that says "replace your 412 ticks", followed
by a failure.

**The reload is load-bearing twice over.** Every screen reads into `useState` in an effect, so after a
replace the mounted surfaces are showing rows that no longer exist and nothing invalidates them. And
`initialiseStorage` re-runs on the reload, which re-applies `seedVenues` over whatever venue rows the file
carried — so the current seed set reasserts itself without an import-specific reseed step.

*Alternative considered:* adding `dexie-react-hooks` and letting `useLiveQuery` invalidate the screens.
Rejected here: it is a real architectural change affecting every screen, in a change about durability, to
avoid one `location.reload()` that is *also* doing the reseeding. It stays available for a later change that
wants it on its own merits.

**Venues are in the payload.** They are seeded and non-editable, so carrying them looks redundant — until a
future seed set drops or renames a site. `bulkPut` overwrites by id and never deletes, so a venue carried in
from an old export survives the reseed and keeps its sessions resolvable. Without it, an old export produces
sessions pointing at nothing.

### Delete removes exactly what export captures

One sentence defines both operations, which settles three questions at once:

```
                    export captures    delete removes    after the next launch
  ticks, sessions        ✓                  ✓            gone
  venues                 ✓                  ✓            reseeded
  preferences            ✗                  ✗            unchanged
```

The dialog states that venues return and preferences stay. An app that says it deleted everything and then
shows a populated venue picker reads as a failed deletion.

The mock's label — *Delete everything* — becomes **Delete my logbook**, because the table above shows
"everything" is not what happens and the honest label costs nothing.

### Persistence: read the state, never re-request

`initialiseStorage` calls `requestPersistence()` on **every** launch. So a refusal already retries itself,
and Chromium's heuristic grants persistence once the PWA is installed — meaning the app self-heals with no
control to press.

That collapses the design to a stateless read:

```
navigator.storage?.persisted is not a function   →  unsupported     (Safari)
await navigator.storage.persisted() === true      →  persisted
                                     === false     →  not persisted
throws                                            →  unknown
```

*Alternatives considered.* Retaining the boot promise in a module variable and awaiting it from settings
gives the exact outcome (`denied` vs `unsupported`) but couples settings to the startup sequence for a
distinction that turns out to be inert: `unsupported` is directly detectable from the API surface, and
`denied` and never-granted produce the same advice — install to the home screen. A "Request again" button
was rejected outright: it repeats what boot did moments earlier and implies the user's inaction caused the
refusal.

The read goes in `db/persist.ts`, beside `requestPersistence`, because that module already owns the guard
chain for environments where `navigator.storage` is undefined rather than merely missing a method — which is
jsdom, and therefore every test.

### Preferences: `localStorage`, and a pre-paint script for the theme

A fourth Dexie table would move the schema marker, put appearance inside the logbook export, and break "three
tables" — for two scalar values. `localStorage` is the right size, and the cost is stated in the spec: what
lives there is outside export, import and delete.

The theme cannot be applied from React. A `useEffect` paints the default first and replaces it, so a cold
start on a stored light theme, or a dark system preference against a hard-coded `dim`, flashes the wrong
theme every launch. A ~5-line inline script in `index.html` reads the key and sets `data-theme` on
`<html>` before the bundle loads. React then reads the same key as its initial state, so the two agree with
no second source of truth.

*Follow system* is `matchMedia('(prefers-color-scheme: dark)')` with a `change` listener, so a system switch
tracks without a reload. `dim` and `winter` remain the only two themes; the preference is three-valued and
resolves to two.

### Haptics live at the write path, not in a wrapper

One `navigator.vibrate?.(…)` call where a tick is written, guarded by the preference read. No abstraction, no
provider, no hook that returns a function that maybe vibrates. It is a bonus signal (`DESIGN.md` §4), so an
absent API is a no-op and not a branch anybody has to handle.

### Download and file selection: platform primitives only

Export is a `Blob` plus an `<a download>` click; import is `<input type="file" accept="application/json">`.
Both work in an installed Android PWA. `showSaveFilePicker` would be a nicer save experience and is
Chromium-only, so it needs the anchor fallback anyway — two paths where one suffices, in a change whose whole
point is a reliable restore.

Dialogs are Base UI with plain utility classes over daisyUI tokens. **Not `modal-box`** — `App.test.tsx`
already guards that, and this change adds two dialogs, which is exactly where the mistake gets made.

### Testing

- **Round-trip is the load-bearing test**: populate a database with rows covering every union arm, export,
  import into a fresh instance, deep-equal. It is what catches a field added to `Tick` and forgotten in the
  export — the failure the digest and the marker cannot see, because both are computed *from* whatever the
  export chose to include.
- Refusals get one test each, asserting both the refusal and that the existing rows are untouched.
- The reformat-tolerance test re-serialises an export with different indentation and asserts it imports.
- The atomicity test forces a failure mid-replace and asserts the old rows survive.
- `URL.createObjectURL` and the anchor click need jsdom stubs; file reading uses `File.prototype.text`.
- The shell geometry re-measure is Playwright at 412×600, as `app-shell` requires.

## Risks / Trade-offs

- **Hand-repair of an export becomes impossible** → Accepted, and stated in the spec. The repair most likely
  to be attempted is editing a marker to defeat the version refusal, which is precisely what D7 wants
  refused. A user who needs different rows can re-import an older file or re-log.
- **The digest is tamper-evidence, not tamper-proofing** → Accepted. Anyone can recompute an FNV-1a digest
  after editing. The check targets accident, and there is no adversary in a single-user local-only app.
- **A second persistence mechanism arrives** (`localStorage` beside Dexie) → Mitigated by scope: two keys,
  read through one small module, explicitly outside the logbook. If preferences grow past a handful this
  needs revisiting, and Phase 1's user concept is when that question changes shape anyway.
- **The inline theme script is untypechecked, unlinted code in `index.html`** → Mitigated by keeping it to
  a few lines with no dependencies, and by the app reading the same key so a script failure degrades to a
  flash rather than a wrong theme.
- **Removing `ThemeSwitch` changes the shell's measured geometry** → The header's height is set by its
  tallest touch target, and the grade grid's floor was established against it. Expected to be a gain, but
  `app-shell` now requires re-measuring on removal, not only on addition. jsdom cannot see it.
- **`location.reload()` inside an installed PWA re-runs the boot sequence** → That is the intent (it is what
  reseeds), but it also re-triggers the storage timeout race and the lazy session close. Both are idempotent
  and already tested; worth watching in the verification pass rather than assuming.
- **A large export on a low-memory phone is built entirely in memory** → Accepted at Phase 0 scale. A month
  of single-user ticks is a few hundred rows; the file is measured in tens of kilobytes.
- **Import while a session is open** replaces that session with whatever the file held → Correct behaviour
  for a restore, and the reload re-derives the open session from the database, which `openSession` is already
  the sole authority for.

## Open Questions

Both resolved before implementation started; kept here with their answers rather than deleted, since each
was a real fork.

- **Does the data section state the tick and session counts, as the mock does?** *Yes.* One `count()` per
  table. It is the only number on the screen that is not a control, and it earns its place by making the
  confirmation dialogs' numbers predictable rather than surprising — the count you were shown is the count
  you are about to lose.
- **Does the theme default to *follow system* or to dark?** *Follow system*, as specified. `DESIGN.md` §3's
  position that gyms are dimly lit argues for dark regardless of the phone's setting, but a phone in a dim
  gym is already in dark mode, so following the system reaches the same place without overriding a choice
  the user made once for every app they own. Revisitable from the trial.
