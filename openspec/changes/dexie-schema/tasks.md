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
      — **narrowing works; no fallback needed.** `styleOf` narrows on `is_send` through the
      intersection with no assertion, and typecheck is clean.
      **Corrected in group 10:** `rawOf` and `priorOf` were also cited here and were *vacuous* — both
      ternary branches returned the same expression and the widened return type accepted the
      un-narrowed union, so they compiled either way. The conclusion stands, but it rested on one
      genuine assertion rather than three. Replaced with narrowing checks that return the narrowed
      literal type
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

- [x] 5.1 Write `apps/web/src/db/seed.ts` with the venues and their hardcoded UUID literals
      — **corrected after review.** The seed set is four locations across two brands, not three:
      Tampereen Kiipeilykeskus has two sites, Nekala and Lielahti. Ristikko was confirmed as a
      Kiipeilyareena site, closing that open question
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

- [x] 6.1 Write `apps/web/src/db/persist.ts` requesting `navigator.storage.persist()` once,
      guarded for absence
      — the DOM lib types `navigator.storage` as always present and `persist` as always callable;
      both overstate reality. Widened with `Omit<Navigator, 'storage'> & { storage?: StorageManager }`,
      since intersecting with an optional property does **not** make the required one optional and the
      lint rule correctly flagged the guard as dead code until then
- [x] 6.2 Wire startup in `main.tsx` to await seeding before first read, and to request persistence
      without blocking on it
      — `initialiseStorage` never rejects. If IndexedDB is unavailable (Firefox private browsing
      throws on open) the app still renders, because a white screen tells the user nothing
- [x] 6.3 Test that a missing `navigator.storage.persist` does not throw
      — covered twice: `navigator.storage` absent entirely, which is jsdom's default and Safari's
      real behaviour, and present-but-without-`persist`
- [x] 6.4 Test that a refused request does not throw — plus a rejected promise, which is a separate
      path from a `false` return

## 7. Documentation

- [x] 7.1 Narrow `CONCEPT.md` §12 Q1 to wall heights only, recording that the sites are decided
      — also corrected §5's Phase 0 summary, which still listed two seed venues and described
      Kiipeilyareena as one brand rather than two locations
- [x] 7.2 Update the `Last updated:` line in `CONCEPT.md` — already today's date, left as is
- [x] 7.3 Note in the design or a code comment that `bulkPut` seeding becomes wrong once §7.5's venue
      submission flow exists in Phase 1
      — recorded in `CONCEPT.md` §7.5 as well as at the call site, since it is a product-level expiry
      date rather than an implementation note

## 9. Correction: Lielahti is boulder-only

- [x] 9.1 Make `default_scale_rope` and `default_scale_boulder` optional, since a boulder-only venue
      has no rope scale — a required field would have forced a lie into the seed data
- [x] 9.2 Encode the scales as a three-member union so a venue offering **neither** discipline is
      unrepresentable, and document that a missing scale means "not offered here" rather than "no
      default chosen"
- [x] 9.3 Reject a `disciplines: Discipline[]` field: it duplicates the same fact and lets the two
      disagree, with nothing to catch a venue claiming rope while having no rope scale
- [x] 9.4 Add Nekala and Lielahti to the seed set; confirm Ristikko's brand
- [x] 9.5 Verify the new guard by planting the failure — widening `VenueScales` to two independent
      optionals made a scale-less venue representable and failed `VenueWithNoScalesIsRejected`
- [x] 9.6 Update the delta spec, proposal, design, and `CONCEPT.md` §5, §7.5, §7.7 and §12

## 10. Correction: the guards did not cover the write path

Found by `/code-review`, not by the verification in group 8 — which is the point of recording it.

- [x] 10.1 Type the tables `Table<Row, string, Row>` instead of `EntityTable<Row, 'id'>`
      — `EntityTable` derives its insert type with an `Omit` of the primary key, and `Omit` over a
      union keeps only the common keys with merged property types. That **flattened** `Tick` and
      `Venue`, so `db.ticks.add({ is_send: false, send_style: 'flash', ... })` compiled cleanly while
      the identical literal annotated `const t: Tick` did not. Probed: under `EntityTable`,
      `send_style` on the insert type resolves to `string`
- [x] 10.2 Add `writes.assert.ts`, asserting against the parameter types read off `add`/`put`/
      `bulkPut` rather than against the row types
      — verified by reverting to the `EntityTable` typing: **11 assertions fail**, 0 when restored
- [x] 10.3 Add runtime write-path tests, so a future insert-type change cannot pass by coercing rows
- [x] 10.4 Fix `DeclaresKey`, which resolved against `keyof Tick` and so could not see a key added to
      one union member only
      — verified by planting `grade_index` on the Font member alone: the old `keyof Tick` form
      reported **no error at all**; the per-member form fails. Three controls added so the helper
      cannot pass by never reporting anything
- [x] 10.5 Replace the vacuous narrowing assertions
      — `rawOf` returned `tick.grade_raw` in both ternary branches with a `string` return type, so it
      compiled whether or not narrowing worked; `priorOf` had the same shape. **Both were cited in
      task 3.4 as the evidence that the six-member-union fallback was unnecessary.** The replacements
      return the narrowed literal type, so a regression is a compile error. `styleOf` was genuine, so
      the 3.4 conclusion stands — but on one leg rather than three

## 11. Correction: the remaining review findings

- [x] 11.1 **Discipline and protection cannot contradict.** `protection: 'none'` *means* boulder
      (§7.4), but the two were independent fields, so `(boulder, lead)` and `(sport, none)` were
      representable. Now a fourth union member of `Tick`. Verified by decoupling them again: two
      assertions fail
- [x] 11.2 **`crypto.randomUUID` is secure-context only**, so it is absent over plain http — the
      stated device-testing route. Added an exact fallback over `crypto.getRandomValues`, which has
      no such restriction: same 122 random bits, same version and variant nibbles. Verified by
      bypassing the guard, which reproduces the real `TypeError: crypto.randomUUID is not a function`
- [x] 11.3 **Startup could hang forever.** A rejecting IndexedDB was handled; a hanging one was not,
      and Dexie has no open timeout. Bounded at 5 s, after which the app renders anyway. The pending
      seed is deliberately not cancelled — Dexie cannot cancel, and if the open completes later the
      rows land regardless
- [x] 11.4 **A storage failure was invisible.** `initialiseStorage` now returns a status instead of
      swallowing it into `console.error`, and `StorageWarning` tells the user the logbook is not
      saving. An empty venue list reads as data loss; §7.6 accepts losing data, not lying about it
- [x] 11.5 **`SCHEMA_MARKER` was hand-maintained and its test compared it to itself.** Now derived
      from `STORES` plus an exhaustive field list whose `satisfies Record<StoredField, true>` fails to
      compile when a row gains a field. Verified both ways: changing an index moves the marker and
      fails the pin; adding a field is a compile error until it is listed, which then moves the marker
- [x] 11.6 **`ended_at` diverged from §7.7.** CONCEPT amended to `ended_at?` with the reason, and
      §7.7 gained the discipline/protection pairing note from 11.1

## 8. Verify

- [x] 8.1 Run `just check` and confirm it exits 0 — exit 0; 29 tests across 4 files
- [x] 8.2 Confirm the Phase 0 scope fence still passes — `apps/web` gained no HTTP, auth or sync
      dependency
      — runtime deps are `@base-ui/react`, `@tickd/grade-spec`, `dexie`, `react`, `react-dom`. No
      match against HTTP, auth, query-cache, socket or GraphQL libraries. `packages/api-client`,
      `openapi.json`, `docker-compose.yml` and Gradle files all still absent
- [x] 8.3 Confirm no Dexie migration exists and the marker is exported
      — one `db.version(1)` call and no `.upgrade(`; the only other `version(` in the file is prose
      in a doc comment. `SCHEMA_MARKER = 'tickd.phase0.v1'` exported from `schema.ts`
- [x] 8.4 Record in the commit message what was verified against what broken state, including the
      outcome of task 3.4
