## 1. The whole-database write paths

- [x] 1.1 Export `fingerprint` from `db/schema.ts`, keeping the FNV-1a implementation where it is, and note in its comment that it now serves both the schema marker and the export digest — one function, so a digest cannot drift from the marker's notion of hashing
- [x] 1.2 Add `db/logbook.ts` with `replaceLogbook(db, payload)` — one `db.transaction('rw', venues, sessions, ticks, …)` doing `clear()` on all three then `bulkPut` on all three, writing rows verbatim with no re-stamping
- [x] 1.3 Add `deleteLogbook(db)` to the same module, one transaction, all three tables cleared, with a comment stating that venues go too because seeding restores them and they are not user data
- [x] 1.4 Add `currentPersistence()` to `db/persist.ts` returning `'persisted' | 'unpersisted' | 'unsupported' | 'unknown'`, guarding `navigator.storage?.persisted` at both levels as `requestPersistence` already does, never requesting and never throwing
- [x] 1.5 Document in `persist.ts` why reading and requesting are separate: requesting is a startup concern that repeats every launch and therefore self-heals, reading answers "is the logbook protected right now" and must be answerable without a second request
- [x] 1.6 Tests in `db/logbook.test.ts`: a replace leaves exactly the supplied rows in all three tables; rows local-only before the call are gone; identifiers and timestamps are written verbatim
- [x] 1.7 Test that a failure during the replace leaves the previous logbook intact — force it by supplying a row that violates the key constraint, and assert the pre-call rows are all still readable
- [x] 1.8 Tests for `deleteLogbook`: all three tables empty afterwards; running `seedVenues` after it restores the seed set
- [x] 1.9 Tests for `currentPersistence`: persisted, unpersisted, an absent `persisted` method reading as `unsupported`, a throwing call reading as `unknown`, and that no call to `persist()` is made in any of them

## 2. The export and import file

- [x] 2.1 Add `features/settings/logbookFile.ts` defining the envelope type — `marker`, `exported_at`, `digest`, `payload: { venues, sessions, ticks }` — with the payload typed from the row types so a new field is carried automatically
- [x] 2.2 Implement `buildExport(db, now)`: read all three tables, build the payload, digest `JSON.stringify(payload)` with `fingerprint`, return the envelope with the current `SCHEMA_MARKER`
- [x] 2.3 Implement `parseImport(text, marker)` returning a discriminated result — `ok` with the payload and its counts, or a refusal of `'unparseable' | 'marker' | 'digest'`. It recomputes the digest from the **parsed** payload, never from the file text, so re-indentation is not modification
- [x] 2.4 Document in the module why there is no per-field validation and why the digest is FNV-1a rather than SHA-256: `crypto.subtle` is secure-context-only, the same trap `newId` records, and it would throw on the plain-HTTP dev server the phone tests against
- [x] 2.5 Implement `exportFileName(now)` → `tickd-YYYY-MM-DD.json`, reusing `localDateOf` from `db/sessions.ts` — the existing authority on `YYYY-MM-DD` — rather than a second date formatter
- [x] 2.6 Implement the download as a `Blob` plus a programmatic `<a download>` click, and the file read as `File.prototype.text`; no File System Access API
- [x] 2.7 Tests: round trip — seed a database with rows covering every union arm (both scales, all four protections, all six outcome pairings, every optional annotation field set and unset), export, import into a fresh instance, deep-equal every row
- [x] 2.8 Tests for the three refusals, each asserting the refusal reason and that nothing was written
- [x] 2.9 Test that a re-indented export still imports, and that changing one field in the payload does not
- [x] 2.10 Test that export and import complete with `crypto.subtle` undefined, standing in for a non-secure context

## 3. Preferences

- [x] 3.1 Add `features/settings/preferences.ts` — two keys, typed read/write helpers, an unrecognised or unreadable stored value falling back to the default rather than throwing
- [x] 3.2 Add the pre-paint theme script to `apps/web/index.html`: read the key, resolve `follow system` through `prefers-color-scheme`, set `data-theme` on `<html>` before the bundle loads. Keep it to a few lines with no dependencies
- [x] 3.3 Rewrite `ThemeSwitch` as the settings control — it becomes `features/settings/ThemeControl.tsx`, since it is now used by one surface rather than shared: three-valued (follow system / dark / light), persisting through `preferences.ts`, and subscribing to `matchMedia('(prefers-color-scheme: dark)')` so *follow system* tracks a system change without a reload
- [x] 3.4 Remove the theme control from `Shell.tsx`'s header, and replace `App.test.tsx`'s "offers a theme switch" with the assertion that the header now carries no button at all
- [x] 3.5 Tests: a stored choice survives a remount; *follow system* follows a simulated `matchMedia` change; an explicit choice ignores the system; a corrupt stored value renders the default; the export contains no preference values

## 4. The settings surface

- [x] 4.1 Add `features/settings/SettingsScreen.tsx` with the three sections in order — appearance, data, and the destructive action last — and register `/settings` in `router.tsx`
- [x] 4.2 Add the `Settings` tab to `TabBar.tsx` with its own icon, and update the comment that currently names both `Flash` and `Settings` as unshipped
- [x] 4.3 Render the storage state from `currentPersistence()`, with the three messages and the action each implies: protected; not protected, install to the home screen; unsupported, staying on the home screen is what stops the seven-day clear
- [x] 4.4 Render the data section: the tick and session counts, the storage state and the export button. The import file input lands with its flow in group 5 — a picker wired to nothing would be a control that lies
- [x] 4.5 Tests: the sections render in order; each persistence state renders its own message and its action; opening the screen issues no persistence request; the shell header no longer carries a theme control (asserted in `App.test.tsx` with group 3)
- [x] 4.6 Test that `/settings` is reachable by URL and that the tab marks itself current, per `app-shell`'s existing tab scenarios

## 5. The destructive paths

- [x] 5.1 Add the import flow: choose file → `parseImport` → on refusal show the reason and stop → on success open the confirmation
- [x] 5.2 Build the import confirmation with Base UI's `AlertDialog` — the dependency's first use — stating what the file holds, when it was exported, and what will be deleted, with **Export first** above **Replace**. Plain utility classes over daisyUI tokens, and none of its modal classes
- [x] 5.3 Commit an accepted import through `replaceLogbook`, then `location.reload()`, and document at the call site that the reload also re-runs seeding and so restores the current venues
- [x] 5.4 Add the delete flow with its own confirmation, stating the counts, that seed venues return and that preferences are kept, with **Export first** beside **Delete**
- [x] 5.5 Tests: a refused file never opens a dialog; a cancelled confirmation writes nothing; a confirmed import replaces and triggers the reload; a confirmed delete empties all three tables
- [x] 5.6 Test that both confirmations state counts read from the database and the file rather than placeholders, and that `App.test.tsx`'s daisyUI popup-class guard still passes with two new dialogs present — it caught this change's comment quoting the class name, which is the guard working

## 6. The haptic

- [x] 6.1 Fire the vibration once where a tick is written in `LoggingScreen`, through a `buzz()` in `features/settings/haptics.ts` that owns the preference read and the widened `navigator.vibrate` guard, with a comment that it is a bonus signal and an absent API is a no-op rather than a branch
- [x] 6.2 Tests: a written tick requests one vibration with the preference on, none with it off, and writes normally where `navigator.vibrate` is undefined

## 7. The documents

- [ ] 7.1 Update `CONCEPT.md` §7.6 to name what shipped: the digest and the three refusals, and deleting the logbook as the on-device answer to wipe-and-restart. Move its `Last updated:` line
- [ ] 7.2 Add a decision-log entry for the export's integrity model — digest over per-field validation, FNV-1a over SHA-256 for the secure-context reason, and deletion having the same reach as export — and index it from `CONCEPT.md`'s decision log section
- [ ] 7.3 Record in the same entry, or beside it, that the settings mock's grade-order, send-style and default-protection rows are deliberately unimplemented, so the mock is not read as a backlog

## 8. Verify

- [ ] 8.1 Run the full gate — `just check` — and confirm codegen, format, typecheck, lint and the whole suite pass
- [ ] 8.2 Re-measure the shell in a real browser at 412×600 with the theme control gone: the grade grid still scrolls within its own bounds, the page does not scroll, and record the new numbers against the old ones
- [ ] 8.3 Exercise export and import against a real browser: export a populated logbook, delete it, import the file back, and confirm the sessions and their goes read identically on the sessions surface
- [ ] 8.4 Confirm a marker refusal in a real browser by editing the marker in an exported file, and a digest refusal by editing a tick's grade — both must refuse, and the logbook must be unchanged afterwards
- [ ] 8.5 Confirm the theme has no flash on a cold start with a stored light theme, and that the choice survives a reload
- [ ] 8.6 Confirm on the trial device that export downloads and import selects a file from an installed PWA, and note what the persistence state reports there
