## ADDED Requirements

### Requirement: Settings is a surface of its own, ordered by frequency and consequence

The app SHALL present a settings surface listing, in order: appearance, the state of the stored logbook
with its export and import actions, and last the destructive action.

The order is the requirement, not decoration. What is touched often sits above what is touched rarely, and
the irreversible action sits below both so it is never adjacent to a control reached by habit. The theme
control moves here from the shell header, which is where `ThemeSwitch` said it belonged from the day it was
written.

#### Scenario: The surface lists its sections in order

- **WHEN** the settings surface is opened
- **THEN** appearance precedes the data section, and the destructive action is last

#### Scenario: The theme control is no longer in the header

- **WHEN** any surface is rendered
- **THEN** the shell header carries no theme control, and the theme is changed from settings

### Requirement: The logbook exports as one self-describing file

Export SHALL write a single JSON file containing an envelope — a schema marker, the moment of export, and a
digest — around a payload of every `venue`, `session` and `tick` row.

Venues SHALL be included even though they are seeded and not user-editable. Seeding converges by `bulkPut`,
which overwrites by id and never deletes, so a venue carried in an older export survives a later seed set
that has dropped it and keeps its sessions resolvable. Omitting venues would make an old export capable of
producing sessions that point at nothing.

The file name SHALL carry the export's local date, because undated files collide in a downloads folder and
give no way to tell which is the newest.

#### Scenario: The payload holds every table

- **WHEN** a logbook with venues, sessions and ticks is exported
- **THEN** the file's payload contains all rows of all three tables

#### Scenario: The envelope identifies the file

- **WHEN** an export is read
- **THEN** it carries a schema marker, an export timestamp and a digest, outside the payload rather than
  inside it

#### Scenario: The file name is dated

- **WHEN** an export is saved
- **THEN** its name carries the local date of the export

#### Scenario: Export works from an installed PWA

- **WHEN** export is used in a standalone installed app
- **THEN** the file is produced without depending on a browser chrome affordance

### Requirement: An export imports back unchanged

An export taken from a logbook and imported into any database carrying the same schema marker SHALL restore
that logbook exactly: the same rows, with the same identifiers, timestamps, local dates and timezone
offsets.

Nothing is re-stamped on import. A tick imported on Thursday keeps the Tuesday it was climbed, for the same
reason a correction never moves a tick's place in time.

#### Scenario: A round trip preserves the logbook

- **WHEN** a logbook is exported and the file is imported into an empty database
- **THEN** every row matches the original, field for field

#### Scenario: Import does not re-stamp time

- **WHEN** a tick is imported on a later day, in a different timezone
- **THEN** its `date_local`, `tz_offset`, `created_at` and `updated_at` are unchanged

### Requirement: Import replaces the logbook and never merges it

Import SHALL replace the local logbook with the file's contents. Rows present locally and absent from the
file SHALL be gone after the import.

Merging would require identity and conflict rules, which is Phase 1's work (§8.3, §7.6). A restore needs
neither, and inventing them here would be sync arriving early and undocumented.

An import SHALL be followed by a reload of the app, so that no surface continues to display rows read before
the replacement — and so that the launch sequence re-runs, restoring the current seed venues over whatever
the file carried.

#### Scenario: Local rows absent from the file do not survive

- **WHEN** a file is imported into a database holding sessions the file does not contain
- **THEN** those sessions are gone

#### Scenario: The app reloads after importing

- **WHEN** an import commits
- **THEN** the app reloads rather than patching the surfaces in place

#### Scenario: Seeding reasserts the current venues

- **WHEN** a file carrying an older seed set is imported and the app reloads
- **THEN** the current seed venues are present, and venues only the file knew about remain rather than
  being deleted

### Requirement: A mismatched schema marker is refused, never upgraded

Import SHALL compare the file's schema marker with the running build's and SHALL refuse the file when they
differ, stating that the export came from a different version and is not upgraded.

Accepting an older shape would mean transforming it, which is a Dexie migration by another name and is what
D7 exchanged for disposable Phase 0 data (§7.6). Refusing keeps the file readable and leaves
wipe-and-restart as the answer a schema change already has.

#### Scenario: An export from another schema is refused

- **WHEN** a file whose marker differs from the running build's is imported
- **THEN** nothing is written and the refusal names the version difference as the reason

#### Scenario: A refusal leaves the logbook untouched

- **WHEN** a file is refused for any reason
- **THEN** the existing logbook is exactly as it was before the file was chosen

### Requirement: A file edited since export is refused

The export SHALL carry a digest computed over its payload, and import SHALL recompute that digest and
refuse the file when it differs, stating that the file has been modified since it was exported.

This exists instead of validating rows field by field. The marker answers whether a file came from this
schema; it cannot answer whether the file is *true* to it, because JSON expresses rows the type system makes
unrepresentable — a boulder carrying `protection: 'lead'` passes every marker check and then corrupts the
`(discipline, grade_scale)` key that every metric groups by. Import is the only write path in the app with
no compiler behind it, and a digest closes it without a second copy of the row invariants to drift from the
first.

The digest SHALL be computed with the same non-cryptographic fingerprint the schema marker uses, and SHALL
NOT depend on `crypto.subtle`, which is secure-context-only: the stated device-testing route is a phone
against the dev server over plain HTTP, where a `SubtleCrypto` digest would throw while production worked.

The digest SHALL cover the payload only, never itself, and SHALL be insensitive to formatting. Re-indenting
a file does not change what it says.

Accepted knowingly: this forecloses hand-repair of an export. That is the intended reading, since the
repair most likely to be attempted is editing a marker to defeat the refusal above.

#### Scenario: An edited value is refused

- **WHEN** a single field is changed in an exported file and the file is imported
- **THEN** nothing is written and the refusal names the modification as the reason

#### Scenario: Reformatting is not modification

- **WHEN** an exported file is re-indented without changing any value and imported
- **THEN** it imports normally

#### Scenario: The digest works without a secure context

- **WHEN** export or import runs on an origin that is not a secure context
- **THEN** the digest is computed and no API-availability error occurs

### Requirement: The destructive actions confirm with verified numbers and offer an export first

Import and delete SHALL each require a confirmation that states what will be lost, using counts read from
the database, and — for an import — counts and an export date read from the file *after* it has passed the
marker and digest checks.

A refused file SHALL never reach a confirmation dialog. Validating first is what lets the dialog state a
number it has actually verified rather than one it hopes is true.

Each confirmation SHALL offer exporting first as an alternative action. A replace and a wipe have no undo
except a file taken beforehand, and the app's position is that undo is persistent and visible rather than a
transient toast.

Confirmation SHALL NOT require typing a phrase. The app is used one-handed with chalky fingers on a 6.9"
screen, where a typed gate is a worse experience than the risk it mitigates.

#### Scenario: An import confirmation states both sides

- **WHEN** a valid file is chosen
- **THEN** the confirmation states what the file holds, when it was exported, and what will be deleted

#### Scenario: A refused file never asks

- **WHEN** a file fails the marker or digest check
- **THEN** the refusal is shown and no confirmation dialog appears

#### Scenario: Exporting first is offered

- **WHEN** either destructive confirmation is shown
- **THEN** it offers taking an export as an alternative to continuing

#### Scenario: Cancelling changes nothing

- **WHEN** a confirmation is dismissed
- **THEN** no rows are written or deleted

### Requirement: An operation that fails says so, and says what survived it

Every action on this surface — export, reading a chosen file, replacing, deleting — SHALL report a
failure next to the control that failed, rather than completing silently or leaving a dialog open with
no explanation.

A tap that does nothing is the worst available outcome on the surface whose whole purpose is being
reliable, and it is the default outcome: each of these handlers hands a promise to `void`, so a rejected
export or a quota-exhausted replace produces an unhandled rejection and no feedback at all.

A failed **replace** or **delete** SHALL state that the logbook was left as it was. Both run in one
all-or-nothing transaction, so that is true — and saying it is what stops the obvious next move being to
press the destructive button a second time.

A file that could not be **read** SHALL be distinguished from a file that was **refused**. Android
revokes content URIs freely, so a picker can hand over a file the disk then will not produce; calling
that "not a tickd export" sends the user looking for a different file that does not exist.

#### Scenario: A failed export is reported

- **WHEN** building or writing the export throws
- **THEN** a message appears beside the export control and nothing is silently discarded

#### Scenario: A failed replace states what survived

- **WHEN** replacing the logbook throws
- **THEN** the message says the logbook was left exactly as it was

#### Scenario: A failed delete states what survived

- **WHEN** deleting the logbook throws
- **THEN** the message appears beside the delete control and says the logbook was left as it was

#### Scenario: An unreadable file is not reported as a refusal

- **WHEN** the chosen file cannot be read
- **THEN** the message says it could not be read, rather than that it is not a tickd export

### Requirement: Deleting removes exactly what an export captures

The surface SHALL offer deleting the logbook, removing every `venue`, `session` and `tick` row in one
all-or-nothing operation.

Deletion and export SHALL have the same reach, so both are describable in one sentence: everything an export
would restore. Consequently the seed venues return on the next launch and the preferences survive, because
neither is your logbook. The confirmation SHALL say so, since an app that claims to have deleted everything
and then shows a populated venue picker reads as a failed deletion.

This exists because Phase 0's answer to a schema change is wipe-and-restart (§7.6, D7), and on an installed
PWA there is otherwise no way to perform it — the trial device has no DevTools.

#### Scenario: The logbook is emptied

- **WHEN** deletion is confirmed
- **THEN** no session or tick remains

#### Scenario: Seed venues return

- **WHEN** the app is launched after a deletion
- **THEN** the seed venues are present and a new session can be started

#### Scenario: Preferences are not deleted

- **WHEN** deletion is confirmed
- **THEN** the theme and haptic preferences are unchanged

### Requirement: The storage state is reported with advice, and is read rather than re-requested

The surface SHALL report whether the browser is protecting the logbook from automatic eviction,
distinguishing persisted, not persisted, and unsupported, and SHALL give the action that applies to each.

It SHALL read the current state rather than requesting persistence again. Persistence is already requested
at every launch, so a refusal self-heals on the next launch once Chromium's heuristic grants it — typically
once the app is installed to the home screen. A retry control would repeat what startup did moments earlier
and imply the user's inaction was the problem.

The advice differs by state, which is why the three are distinguished rather than reduced to a boolean:
*not persisted* is fixed by installing to the home screen, and *unsupported* is Safari, where the protection
is instead that an installed PWA escapes the seven-day unused-data clear.

The report SHALL NOT be raised to a shell-level banner. Being unpersisted means the logbook can be saved but
might later be evicted, which is a different severity from being unable to save at all, and a banner shown
on every launch in a browser that never grants persistence becomes invisible by the third day.

#### Scenario: A persisted origin says so

- **WHEN** the settings surface is opened where storage is persisted
- **THEN** it reports that the logbook is protected from automatic cleanup

#### Scenario: An unpersisted origin gives the action

- **WHEN** the settings surface is opened where persistence has not been granted
- **THEN** it reports the eviction risk and names installing to the home screen as what earns protection

#### Scenario: An unsupporting browser is not reported as a refusal

- **WHEN** the settings surface is opened where the Storage API has no `persisted`
- **THEN** it reports that this browser cannot protect the logbook, rather than reporting a refusal

#### Scenario: Opening settings does not request persistence

- **WHEN** the settings surface is opened
- **THEN** no new persistence request is made

### Requirement: Preferences are device settings, stored outside the logbook

Preferences SHALL be stored in `localStorage`, not in Dexie, and SHALL therefore be absent from the export,
from the import and from the deletion.

Phase 0 has three tables and a schema marker derived from their shape; a preferences table would be a fourth
and would move the marker, so an export would then carry a device's appearance along with its climbing. An
export is a logbook, not a device image — which also keeps §9.0's origin bridge honest, since what crosses
to the new origin is the ticks.

A missing or unreadable stored value SHALL fall back to the default rather than failing.

#### Scenario: A preference survives a launch

- **WHEN** a preference is changed and the app is reloaded
- **THEN** the changed value is still in force

#### Scenario: Preferences are not in the export

- **WHEN** a logbook is exported
- **THEN** the file contains no preference values

#### Scenario: A corrupt stored value is not fatal

- **WHEN** a stored preference holds an unrecognised value
- **THEN** the default applies and the surface still renders

### Requirement: The theme is chosen, persisted, and applied before first paint

The theme preference SHALL offer following the system, dark, or light, defaulting to following the system.
The chosen theme SHALL be applied by setting `data-theme` on the document root before the app's first paint.

Applying it from a React effect paints the previous theme first, so a cold start on a stored light theme —
or a dark system preference against the app's own default — flashes the wrong one. In a dim gym that is a
flash of white at the moment the app is opened, which is exactly the condition `DESIGN.md` §3 makes dark
mode non-optional for.

Following the system SHALL track a later change of the system preference without a reload, **on every
surface rather than on this one**. The control that changes the theme is mounted only while settings is
open, so tracking owned by that control follows the system on the one screen nobody is looking at — a
phone whose schedule flips at sunset does it while the climber is on the logging screen. Tracking
therefore belongs to the app's lifetime, not to a component's.

#### Scenario: The stored theme is applied before first paint

- **WHEN** the app is loaded with a stored theme
- **THEN** the document root carries that theme before the first paint, with no intermediate theme rendered

#### Scenario: Following the system tracks it

- **WHEN** the preference is *follow system* and the system switches to dark
- **THEN** the app switches to dark without a reload

#### Scenario: Tracking does not depend on the settings surface being open

- **WHEN** the preference is *follow system*, another surface is showing, and the system switches
- **THEN** the app follows it

#### Scenario: An explicit choice overrides the system

- **WHEN** the preference is light and the system prefers dark
- **THEN** the app renders light

### Requirement: A written tick may vibrate, under a preference

A haptic SHALL fire once when a tick is written, governed by a preference that defaults to on.

`DESIGN.md` §4 asks for this and nothing implemented it, so the toggle and the vibration ship together — a
control that governs nothing would be worse than no control. It remains a bonus rather than the only
feedback: the tick's visible confirmation is unchanged, because `navigator.vibrate` is unimplemented on iOS
Safari and silent on a device with vibration disabled.

An absent `navigator.vibrate` SHALL NOT be an error, and SHALL NOT prevent the tick from being written.

#### Scenario: A tick vibrates when the preference is on

- **WHEN** a tick is written with the haptic preference on
- **THEN** a single vibration is requested

#### Scenario: The preference suppresses it

- **WHEN** a tick is written with the haptic preference off
- **THEN** no vibration is requested and the tick is written as normal

#### Scenario: An unsupporting device still logs

- **WHEN** a tick is written where `navigator.vibrate` is undefined
- **THEN** the tick is written and no error surfaces

### Requirement: The surface offers no preference that reopens a settled decision

The settings surface SHALL NOT offer a grade-grid ordering control, a send-style control, or a default
`protection` control, notwithstanding that the reference mock shows all three.

Each is absent for its own reason, and stating them here is what stops the mock being read as a backlog.
Grade order was decided easiest-at-top (`DESIGN.md` §5), so a control would re-open it per user. Send style
is derived rather than stored (D20), so there is nothing to set. Default protection is already obsolete:
discipline and protection are seeded from the session's own newest tick, so a preference would govern only
the first go of a session, and the better fix — seeding that first go from the last go anywhere — is a
logging-screen change that needs no setting.

#### Scenario: The absent controls stay absent

- **WHEN** the settings surface is rendered
- **THEN** it offers no grade-order, send-style or default-protection control
