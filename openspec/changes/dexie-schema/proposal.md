## Why

Phase 0 has an installable shell, a grade-scale package and a deployment target, but **nowhere to put a
tick**. Every remaining Phase 0 deliverable — the logging screen, flash rate, JSON export/import —
reads or writes the same three tables, so the storage layer is the thing all of them are blocked on.

It also has to be built *before* the UI rather than alongside it, because `CONCEPT.md` §7.4 defines two
combinations of the style fields that are invalid and that the UI must make unreachable. A UI can only
make unreachable what the model has already ruled out; deciding the shape after the screen exists means
discovering the constraint in a component instead of in a type.

## What Changes

- **A Dexie database** with the three Phase 0 tables — `venue`, `session`, `tick` — at `version(1)` and
  no migrations, because Phase 0 data is disposable by design (D7) and a schema change wipes and
  restarts.
- **Row types that make the invalid style combinations unrepresentable.** `send_style` is null exactly
  when `is_send = false`, and `flash`/`onsight` require `prior_experience = 'none'`. Both become
  compile errors via a discriminated union rather than runtime assertions.
- **Three seed venues**, inserted idempotently on startup: Kiipeilyareena Salmisaari, Kiipeilyareena
  Ristikko (both `default_scale_boulder: 'font'`) and Tampereen Kiipeilykeskus
  (`default_scale_boulder: 'french'`). All three carry `default_scale_rope: 'french'`.
- **`navigator.storage.persist()`** requested once at startup, best-effort and non-blocking.
- **A schema marker constant**, exported now and consumed by the export/import change later, so the
  refuse-on-mismatch rule in §7.6 has something to compare.
- **Indexes chosen for the one Phase 0 analytic.** Flash rate groups by `(discipline, grade_scale)`,
  so that pair is indexed rather than left to a full scan.

Explicitly **not** in this change: JSON export/import and its two buttons (§7.6), any UI, any query
helper for flash rate itself. `default_route_length_m` is seeded absent, leaving §12 Q1 open rather
than closing it with an invented wall height.

## Capabilities

### New Capabilities

- `local-database`: The Phase 0 client-side store — table shapes, the compile-time encoding of the
  style and grade invariants, seed venue identity, migration-free versioning, and storage persistence.

### Modified Capabilities

None. The Phase 0 scope fence in `build-tooling` continues to hold — Dexie is not an HTTP, auth or
sync library — and `app-shell` owns the shell rather than its data.

## Impact

- **New**: `apps/web/src/db/` — schema, row types, seed data, persistence request.
- **Dependencies**: `dexie` (runtime) and `fake-indexeddb` (dev) — jsdom provides no IndexedDB, so
  without the latter the storage layer would ship untested.
- **`CONCEPT.md`**: §12 Q1 narrows from "which site and what wall heights" to wall heights alone.
- **Blocks nothing; unblocks everything.** The logging screen, flash rate and export/import all sit
  directly on top of this.
- **Risk**: the discriminated union is load-bearing and easy to weaken accidentally. A widened type
  would silently re-admit `is_send: false` with a `send_style`, which corrupts flash rate rather than
  erroring — so the change carries type-level assertions in the same style as `grade-spec`.
