---
id: D24
title: The export is checked whole, and deleting reaches exactly as far as it
status: accepted
related: [D7, D16, D17]
---

# D24 — The export is checked whole, and deleting reaches exactly as far as it

**Considered:** trusting the schema marker alone and importing whatever it lets through; validating an
imported file row by row against the tick and venue unions; adding a validation library for the same
purpose; a cryptographic digest over the payload; leaving the wipe-and-restart path to browser DevTools;
labelling the destructive action *Delete everything*, as the settings mock does.

**Decided:** the export carries a **digest of its own payload**, computed with the same non-cryptographic
fingerprint the schema marker uses, and import **refuses any file whose digest does not match** — with no
per-field validation anywhere. Deleting is offered in the app, is called **Delete my logbook**, and
removes **exactly what an export captures**.

**Why a digest rather than validation.** The marker answers *is this file from my schema*. It cannot
answer *is this file true to my schema*, and the difference is not academic: JSON expresses rows that the
type system makes unrepresentable. `{ "discipline": "boulder", "protection": "lead" }` passes every
marker check and then corrupts the `(discipline, grade_scale)` key that every metric groups by — the
exact pairing `types.ts` exists to forbid, arriving through the one write path with no compiler behind
it. Something has to stand in for the compiler at that path. A validator mirroring the row unions would
be that something and would also be **a second copy of the invariants**, free to drift from the first the
moment a field is added — the same failure mode the schema marker was made derived to avoid. A digest
does not describe the invariants at all: it accepts the files this app wrote and refuses every edit,
including all the ones a validator would have had to enumerate.

**What that costs, accepted.** An export can no longer be hand-repaired. Fixing a typo in a note, or
splicing two files together, now means refusing the result — and, more pointedly, so does editing a
marker to slip an old export past the version check. That last case is close to the reason to do it:
D7 traded migrations for disposable data, and a hand-edited marker is the obvious way to reintroduce
migration by the back door.

**Why FNV-1a rather than SHA-256.** `crypto.subtle` is **secure-context-only**, and the stated
device-testing route is a phone against the Vite dev server over plain HTTP (§9.0). A `SubtleCrypto`
digest would therefore throw during exactly the testing this feature most needs, while working in
production — the worst shape a bug can take. `newId` already documents being caught by the identical
restriction on `crypto.randomUUID`. The threat model here is a user who opened their own export in a text
editor, not an attacker, so 32 bits of accident-detection is the right size; the digest is tamper-evidence
and does not pretend otherwise.

**Why formatting is not modification.** The digest is computed over the *parsed* payload rather than the
file's text, so re-indenting or minifying a file still imports while any changed value or reordered key
does not. Hashing the text would refuse a file that someone opened and saved with a trailing newline,
and a check that cries wolf is a check that gets ignored.

**Why deletion belongs in the app.** Phase 0's answer to a schema change is wipe-and-restart (D7), and
until now performing it meant DevTools — which the trial device, an installed PWA on a phone, does not
have. A marker refusal on that device had no recovery action at all short of uninstalling. The same
button also covers the ordinary case of wanting to start the month over.

**Why it is *my logbook* and not *everything*.** Deletion is defined to have the same reach as export, so
one sentence describes both. The consequences of that definition are visible and would otherwise read as
bugs: the seed venues come back on the next launch, because they are seeded rather than entered; and the
theme and haptic preferences survive, because they live in `localStorage` and were never part of the
logbook. An app that claims to have deleted everything and then shows a populated venue picker looks
broken. The confirmation says what returns.

**Why preferences are outside all of it.** A preferences table would be a fourth Dexie table, would move
the schema marker, and would put a device's appearance inside the file whose job is carrying a logbook
across the Phase 1 origin change (§9.0, D16). An export is a logbook, not a device image.

## What this changes

- `CONCEPT.md` §7.6 — the export/import pair gains the digest, the three refusals, and deletion.
- The `settings` capability owns the file format, the refusals, the confirmations and the preferences.
- `local-database` gains the whole-database replace and delete write paths.
- `db/schema.ts` exports `fingerprint`, so the marker and the digest hash the same way.

## What would reverse it

Two conditions, and neither is near.

**A second writer of the file format.** The digest works because exactly one program writes these files.
If a script, an importer from another logbook, or a Phase 1 server ever produces one, the digest stops
being a check on integrity and becomes a lock on interoperability — at which point validation is what is
actually wanted, and it should be written once, generated from the same source as the row types.

**Phase 1 sync.** Once the server is the durable copy, import stops being a restore path and the whole
question of hand-editing a local file changes shape.
