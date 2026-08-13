---
id: D7
title: Phase 0 backup dropped, and with it the Phase 1 claim path
status: accepted
amended_by: [D16]
related: [D16]
---

# D7 — Phase 0 backup dropped, and with it the Phase 1 claim path

**Considered:** scheduled automatic export to a filesystem handle, restore tests, monitoring, and
last-backup-date UI, all treated as a Phase 0 blocker.

**Decided:** none of it. Phase 0 is a single-user trial over about a month, and a month of ticks is
re-enterable from memory. Kept only `navigator.storage.persist()` and a manual export button.

Independently useful finding: **automatic filesystem backup is impossible on mobile anyway.**
`showSaveFilePicker` and persisted `FileSystemFileHandle`s are Chromium-desktop-only — not Safari on
macOS or iOS, not Firefox, not Chrome on Android. Safari exposes only the Origin Private File
System, which is itself evictable and so useless as a backup target.

**This cascaded further than expected.** Because Phase 0 data is disposable:

- Dexie schema changes can wipe and restart, so no tested migration paths are needed until Phase 1.
- **A whole section was deleted.** It had specified a local `owner_id` stamped on every Phase 0 row
  so Phase 1 could "claim" the first month of logging when accounts arrived. With disposable data
  there is nothing to claim, so Phase 0 now has **no user concept at all** — and `device_id`,
  `schema_version` and `visibility` moved to Phase 1 for the same reason.
