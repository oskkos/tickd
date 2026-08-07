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

- [x] 2.1 Write `apps/web/src/db/types.ts` with `Venue`, `Session`, and the `TickBase` fields from
      `CONCEPT.md` §7.7 — including `sector?`, `attempts?`, `high_point?`, `grade_opinion?`, `rating?`,
      `notes?`, `length_m?`, `tags`, `date_local`, `tz_offset`, `created_at`, `updated_at`
      — `session.ended_at` made optional (§7.7 lists it without `?`); a session must be creatable
      before it is finished, since ticks are written into one that has not ended. `grade_opinion`,
      `rating`, `conditions` and `felt` have no defined semantics in §7.7 and are typed
      conservatively, marked provisional in the file
- [x] 2.2 Add `TickGrade` as a union over `{ grade_scale, grade_raw }` using `FrenchLabel`/`FontLabel`
      from `@tickd/grade-spec`
- [x] 2.3 Add `TickOutcome` as the three-member union over `is_send`, `send_style`, `prior_experience`
- [x] 2.4 Compose `Tick = TickBase & TickGrade & TickOutcome`, and confirm no `is_repeat` column exists
- [x] 2.5 Document the `tz_offset` sign convention (minutes **east** of UTC, opposite of
      `getTimezoneOffset()`) in a comment where it cannot be missed

## 3. Prove the invariants hold

- [x] 3.1 Write `apps/web/src/db/types.assert.ts` in the `grade-spec` style, asserting valid
      combinations compile
- [x] 3.2 Add `@ts-expect-error` assertions for each invalid case: send style on an attempt,
      `send_style: undefined` on an attempt, flash with prior experience, send without a send style,
      and a case-mismatched grade/scale pair
      — **`@ts-expect-error` proved unusable here and was replaced.** An invalid literal reports at
      different positions depending on the rule broken: a bad `prior_experience` or a cross-scale
      label reports at the *declaration*, an excess `send_style` at the *property*. Half the
      directives landed on the wrong line and were flagged unused, so the assertions were testing
      their own placement. Replaced with position-independent `AssertNotAssignable` type assertions,
      plus two controls so a trivially-never-assignable helper cannot make them all pass vacuously
- [x] 3.3 Assert `redpoint`/`second_go` with `prior_experience: 'none'` *does* compile
- [x] 3.4 **Verify intersection narrowing actually works** — if `TickBase & TickGrade & TickOutcome`
      does not narrow on the discriminants, fall back to the explicit six-member union per design
      decision 2, and record which path was taken
      — **narrowing works; no fallback needed.** `styleOf`, `rawOf` and `priorOf` narrow on
      `is_send` and `grade_scale` through the intersection with no assertion, and typecheck is clean
- [x] 3.5 Verify the assertions fail when a guard is removed, by deliberately widening the union and
      confirming `tsc` reports the expected violations
      — verified twice against real breakage. Widening `send_style?: never` to `send_style?: SendStyle`
      failed the attempt-with-send-style assertion; widening `grade_raw: FrenchLabel` to `string`
      failed both cross-scale assertions. Restored clean both times

## 4. The database and its indexes

- [x] 4.1 Write `apps/web/src/db/schema.ts` declaring the Dexie subclass with `version(1)` only
- [x] 4.2 Declare stores and indexes per design decision 5, including the `[discipline+grade_scale]`
      compound index and no `*tags` multiEntry index
- [x] 4.3 Export the `SCHEMA_MARKER` constant tied to version 1
- [x] 4.4 Add the id wrapper around `crypto.randomUUID()` rather than calling it inline
- [x] 4.5 Write a test asserting exactly one version is declared and no upgrade callback is attached
      — Dexie exposes no public accessor, so the upgrade check reads `_versions[i]._cfg.contentUpgrade`.
      Verified by adding a real `version(2).upgrade(...)`: both guards failed, then passed once removed
- [x] 4.6 Write a test asserting the compound index exists and that querying by
      `(discipline, grade_scale)` returns only matching ticks
      — the test fixture builder was rewritten mid-task. The first version was
      `{ ...defaults, ...overrides } as Tick`, which left `send_style: 'flash'` in place when a test
      overrode `is_send` to `false`; the cast silenced the invariant the module exists to enforce.
      It now takes whole typed `TickOutcome`/`TickGrade` values and needs no cast

## 5. Seed venues

- [x] 5.1 Write `apps/web/src/db/seed.ts` with the three venues and their hardcoded UUID literals
- [x] 5.2 Set `default_scale_rope: 'french'` on all three; `default_scale_boulder: 'font'` for both
      Kiipeilyareena sites and `'french'` for Tampereen Kiipeilykeskus
- [x] 5.3 Give both Kiipeilyareena rows `brand: 'Kiipeilyareena'` and leave
      `default_route_length_m` absent
- [x] 5.4 Implement seeding as an idempotent `bulkPut`, and comment why it converges rather than
      duplicating
- [x] 5.5 Test that seeding twice leaves the venue count unchanged, on a fresh database per test
      — **the obvious version of this test could not fail and was replaced.** Seeding twice and
      comparing ids passes even with `crypto.randomUUID()`, because a module-level constant is
      evaluated once per process; it differs only between browser launches, which one process cannot
      observe. Verified by planting a generated id: the original test passed. Now asserts the id
      literals directly, which does fail against that same plant
- [x] 5.6 Test that the boulder scale differs across the seed set while the rope scale does not
      — plus a test that Tampere uses French for *both* disciplines, since that is what forbids
      treating `font` as "the boulder scale"

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
