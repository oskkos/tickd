## Context

`apps/web` currently has a shell and nothing behind it. `packages/grade-spec` already provides the
half of the model that had to be compile-time safe — Font and French ordinals cannot be mixed — and
this change provides the other half: the rows those grades live in.

Three constraints shape everything below, and all three come from decisions already argued through:

- **Phase 0 data is disposable (D7).** No Dexie migrations, ever. A schema change wipes and restarts.
  That removes the usual reason to keep a schema loose, so the schema can afford to be strict.
- **Two style combinations are invalid** (`CONCEPT.md` §7.4, D6, D14) and the UI must make them
  unreachable. The model has to rule them out first.
- **`grade_raw` + `grade_scale` are stored; ordinals are derived at read time** (§7.3, §8.4). Nothing
  here may bake an ordinal.

The repo also has a precedent worth following rather than reinventing: `grade-spec` enforces its
namespace invariant with the type system and proves the enforcement with `@ts-expect-error`
assertions that fail the build if a guard is removed. This change uses the same technique for the
style invariant.

## Goals / Non-Goals

**Goals:**

- Three tables matching `CONCEPT.md` §7.7's Phase 0 block, no more and no less.
- The two invalid style combinations are **compile errors**, not runtime assertions.
- A grade and its scale cannot disagree: `{ grade_scale: 'french', grade_raw: '6A' }` does not compile.
- Seeding is idempotent — running it on every launch converges rather than duplicating.
- The storage layer is testable in CI with no browser.

**Non-Goals:**

- **Flash rate itself.** This change indexes for it; computing it is a separate change.
- **JSON export/import** (§7.6). Only the schema marker it will compare against lands here.
- **Any UI.** No components, no hooks, no `dexie-react-hooks` yet.
- **Migrations.** `version(1)` is the only version this phase will ever have.
- **Venue curation, submission or `canonical_id` merging** (§7.5) — Phase 1.
- **Wall heights.** Seeded absent, leaving `CONCEPT.md` §12 Q1 open rather than inventing numbers.

## Decisions

### 1. The style invariant is a discriminated union, not a validator

`CONCEPT.md` §7.4 defines exactly two invalid combinations. Both are expressible in the type system:

```ts
type TickOutcome =
  | { is_send: false; send_style?: never; prior_experience: PriorExperience }
  | { is_send: true; send_style: 'flash' | 'onsight'; prior_experience: 'none' }
  | { is_send: true; send_style: 'redpoint' | 'second_go'; prior_experience: PriorExperience };
```

Member 1 makes `send_style` unrepresentable on an attempt — and because the repo sets
`exactOptionalPropertyTypes`, `send_style: undefined` is rejected too, so the field must be genuinely
absent rather than present-and-empty. Members 2 and 3 split on whether the style implies a first
encounter.

**Why not a `validateTick()` function?** Because the failure is silent rather than loud. A tick with
`is_send: false` and `send_style: 'flash'` does not throw when written; it inflates the flash-rate
numerator forever after, and flash rate is precisely the metric D14 went to some trouble to keep
honest. A validator catches that only where someone remembered to call it.

**Note that `redpoint`/`second_go` accept any `prior_experience`, including `'none'`.** That is
deliberate, not an oversight: working a climb across several goes within a single session leaves the
prior experience *before the first go* at none. Constraining it would forbid a real and common tick.

`is_repeat` is not a column. It is derived from `prior_experience === 'sent'` (D6).

### 2. Grade and scale are a second union, intersected with the first

```ts
type TickGrade =
  | { grade_scale: 'french'; grade_raw: FrenchLabel }
  | { grade_scale: 'font'; grade_raw: FontLabel };

type Tick = TickBase & TickGrade & TickOutcome;
```

`FrenchLabel` and `FontLabel` are the literal unions `grade-spec` already generates, so the case rule
that separates the two notations is enforced here for free — `'6A'` is not a `FrenchLabel`.

**This is the design's one genuine technical risk.** TypeScript does not eagerly distribute
`(A | B) & (C | D)` into a six-member union, and discriminated narrowing across an intersection of two
unions is exactly the sort of thing that works in simple cases and degrades in real ones. It is
verified rather than assumed: a `types.assert.ts` in the `grade-spec` style must show both that valid
combinations compile and that each invalid one does not. **If narrowing proves unreliable, the
fallback is to write the six-member union explicitly** — more verbose, identical guarantees, no
change to any consumer.

### 3. Keys are client-generated UUIDs, and seed venues have fixed ones

`crypto.randomUUID()` for sessions and ticks rather than Dexie auto-increment. Auto-increment keys are
per-database counters, which collide the moment a second device exists — and Phase 1 sync is the
stated destination (§8.3). Paying for UUIDs now costs nothing and avoids a rekey later.

**The three seed venues get hardcoded UUID literals.** This is what makes seeding idempotent: startup
does a `bulkPut` of the same three rows, which converges whether the database is fresh, already
seeded, or freshly replaced by an import. Random ids would duplicate the venue list on every launch.

### 4. `version(1)` and nothing else, enforced by a test

Dexie's version chain is how migrations are declared, so the way to guarantee there are none is to
assert the schema declares exactly one version. That turns D7 from a comment into a failing test if
someone reaches for `version(2)` instead of accepting the wipe.

### 5. Indexes follow the mandated grouping key, and stop there

```
venue    id, name, brand, city
session  id, venue_id, date_local
tick     id, session_id, venue_id, date_local, [discipline+grade_scale]
```

`[discipline+grade_scale]` exists because **every metric groups by that pair** — grouping by either
alone yields a plausible wrong number rather than an error. Indexing the pair makes the correct query
the convenient one.

Nothing else is indexed. A month of single-user ticks is a few hundred rows; `tags` gets no
`*multiEntry` index because no Phase 0 query reads it, and `grade_raw` gets none because grades are
grouped in memory after the compound index has narrowed the set.

### 6. Time is stored three ways, on purpose

Following §7.7: `date_local` as `'YYYY-MM-DD'` (lexicographic order is chronological order, so it
indexes correctly as a plain string), `created_at`/`updated_at` as epoch milliseconds, and `tz_offset`
as **minutes east of UTC** — the ISO 8601 sign, so Helsinki in winter is `+120`.

That sign is stated explicitly because `Date.prototype.getTimezoneOffset()` returns the *opposite*
sign, and a silent negation here would misattribute ticks near midnight to the wrong local day.

### 7. Corrections use `put`, not `update`

§7.1 specifies plain `DELETE`/`UPDATE` for corrections. Dexie's `Table.update()` takes a partial, and
a partial of a discriminated union can move a row between members without the type system seeing the
result — flipping `is_send` to `false` while leaving `send_style` behind.

So outcome changes go through `put` with a whole row. This is a real ergonomic cost, accepted because
it is the exact case the union exists to prevent. Fields outside the union may still use `update`.

## Risks / Trade-offs

- **Intersection narrowing may not behave** → Decision 2 carries its own fallback: expand to an
  explicit six-member union. The type-level assertions are written first so this is discovered at
  build time rather than in a component.
- **jsdom provides no IndexedDB, so the layer could ship untested** → `fake-indexeddb` as a dev
  dependency, registered in the existing `vitest.setup.ts`. Every test gets a fresh database, since a
  shared one makes seed-idempotence tests pass for the wrong reason.
- **`crypto.randomUUID` may be missing under jsdom** → id generation goes through one wrapper rather
  than being called inline, so tests can substitute it. Verify availability before assuming.
- **`bulkPut` overwrites user edits to seed venues** → acceptable in Phase 0, where venues are not
  editable. It becomes wrong the moment §7.5's submission flow exists, so it is Phase 1's problem and
  is noted as such rather than designed around now.
- **Strictness plus no migrations means a schema mistake costs the trial data** → that is the accepted
  Phase 0 bargain (D7, §7.6), and the export/import change is what turns it from lossy into merely
  annoying.
- **Seeding is async and races the first read** → startup awaits seeding before the app reads venues.
  One await at boot, not a guard scattered through callers.

## Open Questions

- **Wall heights** (`CONCEPT.md` §12 Q1) remain unanswered. Seeded absent; the field is optional, so
  vertical metres simply has no data until it is filled in.
- **Is Ristikko correctly a Kiipeilyareena site in Helsinki?** Seeded on that assumption. Wrong seed
  metadata is cheap to fix and costs no data, but it should be confirmed rather than inherited.
