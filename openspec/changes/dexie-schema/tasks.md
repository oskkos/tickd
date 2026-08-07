## 1. Dependencies and test harness

- [x] 1.1 Add `dexie` to `apps/web` dependencies and `fake-indexeddb` to devDependencies
      — also added `@tickd/grade-spec` as a workspace dependency, which the row types need
- [x] 1.2 Register `fake-indexeddb/auto` in `apps/web/vitest.setup.ts` so jsdom gains an IndexedDB
- [x] 1.3 Verify `crypto.randomUUID` is available under jsdom; if it is not, note what the id wrapper
      must fall back to in tests
      — **available**, so no fallback is needed. The probe also found `navigator.storage` itself
      undefined under jsdom, not merely `.persist`, so the guard in group 6 must chain at both levels
- [x] 1.4 Confirm `just check` still passes and the Phase 0 scope fence test is unaffected

## 2. Row types and the invariant encoding

- [ ] 2.1 Write `apps/web/src/db/types.ts` with `Venue`, `Session`, and the `TickBase` fields from
      `CONCEPT.md` §7.7 — including `sector?`, `attempts?`, `high_point?`, `grade_opinion?`, `rating?`,
      `notes?`, `length_m?`, `tags`, `date_local`, `tz_offset`, `created_at`, `updated_at`
- [ ] 2.2 Add `TickGrade` as a union over `{ grade_scale, grade_raw }` using `FrenchLabel`/`FontLabel`
      from `@tickd/grade-spec`
- [ ] 2.3 Add `TickOutcome` as the three-member union over `is_send`, `send_style`, `prior_experience`
- [ ] 2.4 Compose `Tick = TickBase & TickGrade & TickOutcome`, and confirm no `is_repeat` column exists
- [ ] 2.5 Document the `tz_offset` sign convention (minutes **east** of UTC, opposite of
      `getTimezoneOffset()`) in a comment where it cannot be missed

## 3. Prove the invariants hold

- [ ] 3.1 Write `apps/web/src/db/types.assert.ts` in the `grade-spec` style, asserting valid
      combinations compile
- [ ] 3.2 Add `@ts-expect-error` assertions for each invalid case: send style on an attempt,
      `send_style: undefined` on an attempt, flash with prior experience, send without a send style,
      and a case-mismatched grade/scale pair
- [ ] 3.3 Assert `redpoint`/`second_go` with `prior_experience: 'none'` *does* compile
- [ ] 3.4 **Verify intersection narrowing actually works** — if `TickBase & TickGrade & TickOutcome`
      does not narrow on the discriminants, fall back to the explicit six-member union per design
      decision 2, and record which path was taken
- [ ] 3.5 Verify the assertions fail when a guard is removed, by deliberately widening the union and
      confirming `tsc` reports the expected `@ts-expect-error` violations

## 4. The database and its indexes

- [ ] 4.1 Write `apps/web/src/db/schema.ts` declaring the Dexie subclass with `version(1)` only
- [ ] 4.2 Declare stores and indexes per design decision 5, including the `[discipline+grade_scale]`
      compound index and no `*tags` multiEntry index
- [ ] 4.3 Export the `SCHEMA_MARKER` constant tied to version 1
- [ ] 4.4 Add the id wrapper around `crypto.randomUUID()` rather than calling it inline
- [ ] 4.5 Write a test asserting exactly one version is declared and no upgrade callback is attached
- [ ] 4.6 Write a test asserting the compound index exists and that querying by
      `(discipline, grade_scale)` returns only matching ticks

## 5. Seed venues

- [ ] 5.1 Write `apps/web/src/db/seed.ts` with the three venues and their hardcoded UUID literals
- [ ] 5.2 Set `default_scale_rope: 'french'` on all three; `default_scale_boulder: 'font'` for both
      Kiipeilyareena sites and `'french'` for Tampereen Kiipeilykeskus
- [ ] 5.3 Give both Kiipeilyareena rows `brand: 'Kiipeilyareena'` and leave
      `default_route_length_m` absent
- [ ] 5.4 Implement seeding as an idempotent `bulkPut`, and comment why it converges rather than
      duplicating
- [ ] 5.5 Test that seeding twice leaves the venue count unchanged, on a fresh database per test
- [ ] 5.6 Test that the boulder scale differs across the seed set while the rope scale does not

## 6. Storage persistence and startup

- [ ] 6.1 Write `apps/web/src/db/persist.ts` requesting `navigator.storage.persist()` once,
      guarded for absence
- [ ] 6.2 Wire startup in `main.tsx` to await seeding before first read, and to request persistence
      without blocking on it
- [ ] 6.3 Test that a missing `navigator.storage.persist` does not throw
- [ ] 6.4 Test that a refused request does not throw

## 7. Documentation

- [ ] 7.1 Narrow `CONCEPT.md` §12 Q1 to wall heights only, recording that the sites are decided
- [ ] 7.2 Update the `Last updated:` line in `CONCEPT.md`
- [ ] 7.3 Note in the design or a code comment that `bulkPut` seeding becomes wrong once §7.5's venue
      submission flow exists in Phase 1

## 8. Verify

- [ ] 8.1 Run `just check` and confirm it exits 0
- [ ] 8.2 Confirm the Phase 0 scope fence still passes — `apps/web` gained no HTTP, auth or sync
      dependency
- [ ] 8.3 Confirm no Dexie migration exists and the marker is exported
- [ ] 8.4 Record in the commit message what was verified against what broken state, including the
      outcome of task 3.4
