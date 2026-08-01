# tickd — concept

**An indoor climbing logbook.** Rope and boulder. Outdoor ticks work, but are deliberately
secondary.

Status: shaping. Nothing built yet.
Last updated: 2026-08-01

The main body describes the current design only. Reasoning that was argued through and changed
along the way is in the **[Decision log](#decision-log)** at the end, so the design reads cleanly
without losing the history.

---

## 1. Decisions at a glance

| | |
|---|---|
| **What** | Indoor climbing logbook: rope (lead / toprope / auto-belay) and boulder. |
| **Audience** | Personal tool first, public product later. Never both at once. |
| **Scope** | Indoor. Outdoor works but is explicitly worse — The Topo owns Finnish outdoor. |
| **Route data** | None. Ticks are anonymous; the app stores no route database at all. |
| **Platform** | Mobile-first PWA, offline-capable. Dexie/IndexedDB is the client source of truth. |
| **Grades** | French (`4`…`9c`) for rope, Fontainebleau for boulder. Separate ordinal namespaces. |
| **Venues** | Curated gym list plus user submissions for review. The only entity needing dedup. |
| **Backend** | Kotlin + Spring Boot 4.1 + jOOQ 3.21 + PostgreSQL. Phase 1 onward. |
| **Hosting** | Cloud Run `europe-north1` (Hamina, FI), scale-to-zero, + Neon. ~€0, fully managed. |
| **Auth** | OAuth2 only, Google first. No password storage. Backend-for-frontend pattern. |
| **Repo** | Monorepo. pnpm workspaces + Gradle. |
| **Distribution** | Web first. A Play Store listing via TWA stays possible but uncommitted (§10). |
| **Goal** | Build it well and use it. Not a job-hunting artifact — so no infrastructure for show. |
| **Priorities** | Fast logging → progression analytics → projecting → social. In that order. |

---

## 2. Market position

**Indoor is unclaimed, and structurally so.** Every incumbent is gym-integrated: TopLogger needs
the gym to sign up and pay, Vertical-Life needs the gym on their platform, WiseGym is one gym's
in-house app. That model can only ever cover gyms that bought software — and Finnish indoor is
fragmented precisely because most haven't. Kiipeilyareena runs on Vertical-Life, Tampereen
Kiipeilykeskus on WiseGym, and Boulderkeskus, Isatis, Oulu CC and others on nothing in particular.

**Because tickd needs no route data from anyone, it works at every gym on day one** — including
gyms with no software at all. No integration, no partnership, no gym-side setup. TopLogger and
Vertical-Life cannot match that by construction. This is why the fragmented market is an
opportunity rather than an obstacle, and it falls directly out of the anonymous-tick design (§7.2).

**Outdoor is conceded.** The Topo (formerly 27 Crags, a Finnish company) is the de facto Finnish
outdoor database — 2,320 destinations, revenue-shared to topo authors, with nearly every popular
crag behind Premium at ~$8/mo. Competing means either building a guidebook database from nothing
or ingesting theirs, and Kaya's 2025 plagiarism controversy shows exactly how the latter ends.
Outdoor ticks should work in tickd; nobody should choose tickd *because* of them.

**No incumbent has a usable public API.** 8a.nu/Vertical-Life has none — confirmed by their own
staff, with CSV export the only sanctioned path. TopLogger has no official API, and the
community-reverse-engineered REST docs are stale since they moved to GraphQL. Integration isn't
available to anyone, which removes a whole class of competitor advantage.

**The consistent complaint across all of them is UX, not features.** 8a.nu is dated, clunky and
gamified around a points ranking. Kaya's gym maps lag. TopLogger's rebuild replaced the "new
routes" view with a social feed users didn't ask for. Mountain Project has essentially no logging
analytics and is being funnelled into onX Backcountry.

**OpenBeta won't help.** The GraphQL API is live, data is CC0, and it's maintained — but it's
volunteer-run and heavily US-centric. Not a foundation for anything here.

---

## 3. The wedge

> **Log a climb in a couple of taps, offline, at any gym. Get analytics that tell you the truth
> about your climbing instead of a leaderboard position.**

Three commitments that differentiate:

**Zero gym dependency.** No integration, no partnership, no waiting for your gym to buy software.
"At any gym" is load-bearing — see §2.

**No points game.** 8a.nu awards bonus grades and points for onsights and flashes over redpoints.
Whatever the exact multipliers, the effect is well known: it rewards grade inflation and
optimistic logging. Analytics here answer "where is my actual limit and what's holding me back",
never "what's my rank".

**Offline is a requirement, not a feature.** Gym basements have no signal. If logging fails
offline, the app fails. This drives the whole architecture.

### What fast logging means concretely

- The app opens directly on the logging screen. No dashboard, no feed.
- Venue is pre-filled from the last session, with GPS as a *background hint* only — indoors it may
  never resolve, so the UI must be fully usable without it.
- Tap grade → tap style → logged.
- The grid is a **grade** grid, not a route list. There is no route inventory to browse (§7.2),
  which is exactly why this is the fastest possible flow.
- There is **no route name field**. Indoor routes are anonymous, and forcing a name is precisely
  why logging feels slow elsewhere.
- Everything else — notes, tags, attempts, opinion grade — is progressive disclosure on the same
  screen, never a required step.

Honest accounting: it's two taps *in the steady state*, once a session is open and the venue is
known. The first tick of a session costs a few more. Don't market "two taps"; build for "faster
than anything else, every time".

**Undo is first-class.** A two-tap UI maximises mis-taps, so correction is the common case rather
than the exception. Undo must be instant and always visible.

---

## 4. Feature pillars

### 4.1 Fast logging
Sessions, ticks, offline queue, optional detail, instant undo. Style is recorded as three orthogonal
fields — `protection`, `send_style` and `prior_experience` (§7.4). Values follow community convention
so the data stays portable. Repeats are derived from `prior_experience = sent` and excluded from
pyramids.

### 4.2 Progression analytics

- **Flash rate by grade** — the flagship metric, and the honest version of "what grade do you
  climb": the grade where your flash rate crosses ~50% is your real level. No existing app
  surfaces it well. Defined as **flashes ÷ first encounters** (`prior_experience = none`),
  *including* the first encounters you never sent — dividing by sends instead is biased upward at
  exactly the limit grade the metric exists to locate (D14). Shown with its raw counts
  (`7a — 1/10`); you read the crossing yourself rather than being handed a headline grade.
- **Segment, never exclude.** Every metric breaks down by `protection` (lead / toprope /
  auto-belay) *and* `send_style`, with lead as the default view. Auto-belay laps get their own
  numbers rather than being hidden or discounted — aggregating across categories is what misleads,
  and dropping data is its own distortion.
- Grade pyramid, rolling 12 months, per discipline and per `protection`. Boulder and rope are
  always separate, since Font and French are different scales (§7.3).
- Volume: sessions, ticks, and vertical metres — the last of which is free indoors via
  `venue.default_route_length_m` (§7.5).
- Style weakness: send rate by tag (slab / vert / overhang / roof, crimp / sloper / pinch,
  power / endurance / technical).
- Trend and plateau detection on median grade.
- No global ranking. Comparison is against your own past self.

### 4.3 Projecting & session notes

- **Log attempts without logging a send** (`is_send = false`). Every app gets this wrong: the
  logbook records only success, so a three-month project appears as a single day.
- Per-attempt beta notes, conditions, high point, what changed.
- Project view: attempt count over time, high-point progression, notes timeline. Grouped by a
  `project` you named, since indoor routes have no identity of their own (§7.2).
- Photos and video optional, local-first (storage cost is real).

### 4.4 Social — deliberately last
Cold start is brutal, and rushing it degrades the other three pillars (see TopLogger's feed
backlash). When it comes: follow friends, session-level feed, shared projects, seeded by real
friend groups rather than a public feed as the front door.

Note that "gym-local recently set" is **not possible** without gym integration — there's no route
inventory to draw on.

---

## 5. Phasing

Timelines assume solo, part-time.

### Phase 0 — Personal logbook (~4–6 weeks)

Local-only PWA. No accounts, no backend, no sync, no backup, **no user concept at all**.
Dexie/IndexedDB, three tables: `venue`, `session`, `tick`.

Indoor only, rope *and* boulder. One grade-grid component with French and Font label sets.
`protection` of lead / toprope / auto-belay / none. No onsight option. Optional free-text `sector`
with per-venue autocomplete. Instant undo. A manual JSON export button. **Plus
flash-rate-by-grade.**

Seed venues: **Tampereen Kiipeilykeskus** and **Kiipeilyareena** (a specific Helsinki site — see
§7.5). Wall heights needed for the vertical-metres metric.

Data is disposable: schema changes may wipe and restart, so **no Dexie migration work** (§7.6).

Flash rate ships here deliberately. Without one real analytic, the exit criterion below would test
a plain offline logbook against a value proposition that doesn't yet exist.

*Exit criterion: you log every session for a month and stop reaching for anything else.*

### Phase 1 — Accounts and sync (~6–8 weeks)

Kotlin/Spring Boot backend on Cloud Run, OAuth2, multi-device sync. Grade pyramid, volume metrics.
Adds `app_user`, `user_identity`, and `user_id` on existing tables.

Sync is the bulk of this — budget it properly (§8.3). It's also the real answer to durability,
which is a reason not to let Phase 0 drift.

*Exit criterion: you'd hand it to a climbing friend without apologising.*

### Phase 2 — Projecting and depth

`project` grouping table and `session_note`. Project timeline, beta notes, photos, full analytics.
Attempts are already captured in Phase 0 via `is_send`; this phase builds the views over them.

### Phase 3 — Multi-user

Follow/feed, friend-group comparison, gym-level stats (which the curated venue list makes
possible). No shared route library — indoor routes are ephemeral and personal, and outdoor is
conceded.

### Phase 4 — Optional

Gym partnerships, on the TopLogger model where gyms pay and climbers don't. This would be purely
*additive*: tickd already works without gym cooperation, so a partnership adds route lists and
leaderboards rather than being a precondition for anything.

A Google Play listing (§10) sits here at the earliest. It carries an annual maintenance tax rather
than a one-off cost, and it is the *public product* half of §1's never-both-at-once.

**Explicitly not planned:** outdoor guidebook data, in any form, from any source.

---

## 6. Product boundaries

Things deliberately absent, so they don't get reinvented:

- **No route database.** Not for indoor, not for outdoor. See §7.2.
- **No colour-based grading or identification.** Kiipeilyareena explicitly notes a 6A may have
  pink holds and a 7B yellow ones.
- **No logbook import.** No 8a.nu CSV, no The Topo migration.
- **No global leaderboard or points system.**
- **No onsight in the indoor UI.** You can see the whole route from the ground and have probably
  watched someone on it; recording indoor ascents as onsight would inflate your numbers and make
  flash rate meaningless. The value stays in the model for outdoor use.

---

## 7. Data model

### 7.1 Corrections: plain `DELETE` and `UPDATE`

Rows carry `created_at` and `updated_at`; edits are last-write-wins on `updated_at`. Deletes are
ordinary deletes. That's all.

Deletes are *communicated* through the sync outbox as an operation — `{op: delete, table: tick,
id: X}` — dropped once the server confirms. The one case incremental pull can't express is a row
deleted while a device was offline, since an absence leaves no trace. The fix is a **periodic full
re-sync** on app launch: at a few megabytes, pulling everything and replacing local state is cheap
enough to do routinely, and it removes any need for tombstones.

**Session notes are append-only timestamped entries, not one edited text field.** Free text edited
on two devices is the one place last-write-wins genuinely hurts — you'd silently lose half a note.

### 7.2 Ticks are anonymous — there is no route entity

**Route identity is not something the app can know.** A newly set 6c+ in sector 4 is
indistinguishable from the 6c+ that used to be in sector 4. There is no observable signal
separating them, and the gyms in question don't use hold colours as identifiers.

So `route` and `ascent` collapse into a single `tick` table:

```
tick { venue_id: <gym>, sector: '4',
       discipline: 'sport', grade_raw: '6c+', grade_scale: 'french',
       protection: 'lead', prior_experience: 'none', send_style: 'flash',
       is_send: true, date_local: today }
```

Two taps. Nothing created, nothing matched, nothing to get wrong.

**Why this is right, not merely easier:**

- **You already know whether you've climbed it before.** You're standing in front of the wall.
  Flash-versus-redpoint was always a self-report — the app never verified it and never could.
- **None of the analytics need route identity.** Pyramid, flash rate, volume and style breakdown
  all compute from `(grade, protection, send_style, prior_experience, date)` on the tick.
- **Identity only matters for projects, and that's exactly where you'll happily name things.** The
  overwhelming majority of indoor ticks are one-offs you'll never revisit.
- **Your history survives routes being stripped**, trivially. Almost every route you've climbed
  indoors no longer exists, and a design where that erodes your pyramid would be useless.
- **It matches how indoor climbers think.** Nobody maintains an inventory of their gym.

**Projects are a grouping key, added in Phase 2:**

```
project  id, venue_id, name, created_at, retired_at?
tick     ... project_id?          -- nullable FK
```

You create a project by naming it — *"the 7a on the arch with the bad clip"* — so identity is
unambiguous because **you** asserted it. Attempts and the eventual send point at it.

If a wishlist ever matters — "routes I want to do", needing an entity that exists *before* any
tick — introduce `route` then, as a new table with a nullable `tick.route_id`. Additive and cheap.

### 7.3 Grades

**Store what was entered and convert at read time.** Store `grade_raw` (`"6c+"`, `"6A"`) and
`grade_scale`. Do *not* bake a canonical ordinal at write time: cross-scale conversion is lossy and
contested, so a corrected conversion table would otherwise leave permanently wrong history.
Convert to ordinals at read time through a **versioned** conversion table, and cache derived
values.

**Scales:**

- **French** for rope: `4, 4+, 5, 5+, 6a, 6a+, 6b … 9c`. Note that `4+` and `5+` aren't additions —
  sub-6a French grades use number-plus-modifier rather than letters, so that *is* the standard
  scale.
- **Fontainebleau** for boulder: uppercase `6A`, `7B`. This is what Kiipeilyareena uses, having
  switched to it explicitly and kept the old circuit colour as the tag background
  ([announcement](https://kiipeilyareena.com/uusi-bouldereiden-greidaussysteemi/)).

**One UI component, two ordinal namespaces.** Both scales are number + letter + optional `+`, so
one grid component with two label sets serves both. But they are **not the same scale**: Font `6A`
and French `6a` look nearly identical and mean very different things — a Font 6A boulder is far
harder than a 6a route. Mapping them to one ordinal would put boulders and routes on a single
pyramid and quietly corrupt every metric. The shared appearance is a UI convenience, never a
data-model one.

**The model must also handle:**

- **Open grades** — `"6A/6A+"`, `"7a/7a+"`. Ordinals are a *range* or fractional value.
  Retrofitting this is expensive.
- **Unknown / project grades** — nullable ordinal, excluded from pyramids and surfaced separately.

Deferred: Finnish sport/trad, Scandinavian and UIAA matter only for outdoor. V-scale and YDS stay
display-only conversions. The model supports them all; the UI ships French and Font.

### 7.4 Style needs three fields, not one

A flat 8a.nu-style enum (`onsight | flash | redpoint | second_go | toprope | repeat`) conflates three
independent questions — how you were protected, how the send went, and what you had climbed before —
and forces `toprope` into the same slot as `flash`, so you cannot distinguish a toprope flash from a
toprope redpoint. Indoors, lead-versus-toprope is the *primary* quality axis, so that throws away the
most interesting signal in the data.

```
protection        lead | toprope | autobelay | none       -- none = boulder
send_style        onsight | flash | redpoint | second_go  -- null when is_send = false
prior_experience  none | attempted | sent                 -- history before this tick's first go
```

`protection = none` cleanly separates bouldering from rope without a second discipline check.

**`prior_experience` replaces an `is_repeat` boolean, and the third value is the point of it.** A
boolean can say "I had sent this before" but not "I had tried this before and never sent it" — which
is simultaneously the project case (§4.3) and the denominator of flash rate (§4.2). The three-value
field also makes the contradictory state unrepresentable rather than merely discouraged: a repeat you
have never touched cannot be expressed. `is_repeat` is derived as `prior_experience = sent`.

It is read relative to **the first go this tick records**. A route you had never touched, that took
four goes this afternoon and that you logged as one redpoint row, is `prior_experience = none`.

Two combinations are invalid and the UI must make them unreachable: `send_style` of `flash` or
`onsight` requires `prior_experience = none` — you cannot flash something you have already touched —
and `send_style` is null exactly when `is_send = false`. The first is what stops flash rate's
numerator exceeding its denominator.

### 7.5 Venues: curated list plus user submissions

`venue` is **the only entity where identity and dedup still matter**, so it's worth getting right
rather than leaving free-form. Free-form would produce fifteen spellings of "Kiipeilyareena
Salmisaari" and destroy any future gym-level comparison — but a purely admin-curated list would
block anyone whose gym isn't listed, which is fatal for the "works at any gym" promise in §2.

- A seeded, searchable list of Finnish gyms with GPS-proximity ordering. Tractable: there are only
  dozens in Finland, and Redpoint's app already maintains a complete Finnish directory.
- **"My gym isn't listed"** creates the venue immediately so nobody is blocked, flagged
  `pending_review` for later merging.
- `canonical_id` lives here and nowhere else. Volume is low enough to moderate by hand.

**Locations, not brands.** Kiipeilyareena has several sites (Salmisaari, Konala, Kontula) with
different walls and wall heights. `venue` is a location; an optional `brand` groups them for
display. Wall height is per location, since it drives the vertical-metres metric.

In Phase 0 this is trivial — hardcode your gyms as seed rows. Curation and submission only become
real in Phase 1.

### 7.6 Durability

**Phase 0 has no backup, deliberately.** IndexedDB is evictable: iOS Safari clears unused site data
for non-installed PWAs, and both Safari and Chrome evict under storage pressure. Accepted anyway —
Phase 0 is a single-user trial over about a month, and a month of ticks is re-enterable from
memory.

Two things stay, because they're nearly free:

- **`navigator.storage.persist()`** — one line, materially reduces eviction risk.
- **A manual "export JSON" button** — about fifteen lines. Not a backup system; an escape hatch.

Two consequences, accepted knowingly:

- A wipe costs you the *evaluation*, not just the data — you'd restart the month-long "do I
  actually use this" test. Annoying, not fatal.
- **Phase 0 schema changes can just wipe and restart**, which is the upside: no tested Dexie
  migration paths needed. Migration discipline starts at Phase 1, when the data becomes worth
  keeping.

**From Phase 1, sync is the real durability answer**, plus a weekly encrypted `pg_dump` to
Cloudflare R2 (§9.4). Disposable is fine for a month and unacceptable for a year.

### 7.7 Schema

```
-- ── Phase 0 ────────────────────────────────────────────────────────

venue        id, type(indoor|outdoor), name, brand?, city, country, geo?,
             default_route_length_m?,        -- wall height, per location
             default_grade_scale,            -- 'french' rope / 'font' boulder
             pending_review, canonical_id?   -- §7.5

session      id, venue_id, date_local, started_at, ended_at,
             conditions?, felt?
             -- mutable; LWW per field

tick         id, session_id, venue_id,
             sector?,                                   -- free text, autocompleted
             discipline(boulder|sport|trad),
             grade_raw, grade_scale,
             protection(lead|toprope|autobelay|none),
             send_style(onsight|flash|redpoint|second_go)?,  -- null when is_send = false
             prior_experience(none|attempted|sent),
             is_send,                                   -- false = attempt only
             attempts?, high_point?, grade_opinion?, rating?, notes?,
             length_m?,                                 -- else venue default
             tags[],
             date_local, tz_offset, created_at, updated_at

-- ── Phase 1 adds ───────────────────────────────────────────────────

app_user     id, display_name, created_at, deleted_at?
user_identity id, user_id, provider, provider_subject_id, email, linked_at
             -- unique(provider, provider_subject_id); never key off email

session      ... user_id
tick         ... user_id, device_id, schema_version,
                 visibility(private|friends|public)

-- ── Phase 2 adds ───────────────────────────────────────────────────

session_note id, session_id, created_at, text
             -- append-only, avoids text-merge conflicts (§7.1)

project      id, venue_id, name, created_at, retired_at?
tick         ... project_id?
```

**Notes:**

- **`date_local` *and* `created_at` *and* `tz_offset`.** A climb belongs to the local day you
  climbed it — but without an instant you cannot order ticks within a session or compute session
  duration. Store all three.
- **`is_send` replaces a separate `attempt` table.** An attempt is a tick you didn't send: same
  shape, one boolean. Pyramids filter `is_send = true`; projecting reads the rest. Phase 0 therefore
  captures attempts for free, even though the projecting *views* are Phase 2.
- **Flash rate deliberately does *not* filter `is_send = true`.** Its denominator is every first
  encounter (`prior_experience = none`), and the ones you walked away from are precisely what make
  the number honest (§4.2, D14). This is the one metric where attempt rows carry weight — which is
  the real reason attempt capture belongs in Phase 0 rather than waiting for the Phase 2 views.
- **`venue.default_route_length_m` makes vertical metres free.** Set it once per gym and every
  tick contributes to the volume metric with no extra input. Per-tick `length_m` overrides it.
- **`device_id`, `schema_version` and `visibility` arrive in Phase 1.** They exist for sync and
  sharing; a single-device local database needs none of them, and Phase 0 data is disposable so
  there's nothing to backfill.
- **`trad` is in the discipline enum for outdoor completeness only.** It never appears in the
  indoor UI.

---

## 8. Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript | Best PWA tooling. SvelteKit is a fine alternative. |
| UI | Tailwind + daisyUI + Base UI | daisyUI for appearance, Base UI for behaviour. Themes come free. See `DESIGN.md` §6. |
| Local store | **Dexie (IndexedDB)** | Client source of truth. Reads never touch the network. |
| PWA | Vite PWA plugin / Workbox | App shell precached, offline by default. |
| Charts | uPlot or Recharts | Pyramids and trends. |
| Backend | **Kotlin + Spring Boot 4.1 + jOOQ 3.21** | §8.1. |
| Database | **PostgreSQL** (Neon) | jOOQ OSS supports it fully; no licence friction. |
| Migrations | Flyway, plain SQL | Schema source of truth — jOOQ generates from it. |
| API contract | springdoc OpenAPI → generated TS client | Closes the type loop to the PWA. |
| Sync | Custom outbox + pull cursor | §8.3. |
| Testing | JUnit 5 + Testcontainers | §8.5. |

**Phase 0 needs no backend at all.** Dexie only — so none of this blocks starting.

Versions as of July 2026: Spring Boot **4.1.0** (June 2026, Java 17 minimum, supports up to Java
26, needs Spring Framework 7.0.8+). jOOQ **3.21** Open Source Edition on Maven Central, with
PostgreSQL and `jooq-kotlin` fully supported.

### 8.1 Why Kotlin + Spring Boot + jOOQ

**The analytics pillar is SQL-shaped.** Flash-rate-by-grade, rolling pyramids, plateau detection
on a median trend, send-rate by tag — window functions, lateral joins, `percentile_cont`. An ORM
fights you here; jOOQ is the best available tool for writing that SQL type-safely. The flagship
metric lives in exactly its sweet spot.

**Schema source of truth is clean.** Flyway SQL → jOOQ codegen → Kotlin types → springdoc OpenAPI
→ generated TypeScript client. One schema definition propagates end to end.

**Kotlin's type system suits the domain.** Exhaustive `when` over `protection` and `send_style`
means adding a value forces every analytics branch to be reconsidered rather than silently
defaulting.

### 8.2 What you own

- **Auth** — OAuth2 only (§8.6). Cheaper than it looks, but not free.
- **Account lifecycle and GDPR** — data export and hard delete, for EU users, with geolocation in
  the data. Not optional; you're in Finland.
- **CI, container builds, migrations on deploy, and a weekly backup job.** Hosting and ops are
  otherwise near-zero (§9).

### 8.3 Sync is a 2–3 week job, not a weekend

Push side: idempotency keys, FK-dependency ordering (venue → session → tick, created offline in one
flush), partial batch failure, transient-versus-permanent error classification with a dead-letter
path so one poisoned row can't block the queue forever, multi-tab leader election, auth refresh
mid-flush, Dexie's "transaction dies on a non-Dexie await" trap, and payloads queued under one app
version flushing after a deploy.

An outbox is push-only, so you also need a pull cursor, pagination, clock-skew handling, initial
full sync on a new device, and applying remote rows without clobbering local pending edits. Plus
the periodic full re-sync from §7.1.

Managed sync engines (ElectricSQL, PowerSync, Triplit, Zero) would each fight a custom backend, so
they're less attractive here than they'd be against a managed database.

### 8.4 Grade conversion lives in one spec, generated to both sides

Conversion happens at read time and the app must work offline, so ordinal conversion runs in the
browser. But the backend needs the same tables for server-side analytics.

**Don't hand-maintain two conversion tables.** Define scales and conversions once as a versioned
YAML spec in the repo, and generate both the Kotlin and TypeScript implementations from it.
Versioned, so a corrected conversion is a new version rather than silent history rewriting.

Resist Kotlin Multiplatform for this — sharing one small pure-function module isn't worth pulling
KMP into a React PWA build.

### 8.5 Testing

This is a data-integrity app with lossy grade conversion, offline sync and — from Phase 1 —
data you can't recreate. Minimum:

- **Testcontainers with real PostgreSQL** for every jOOQ query. The analytics SQL is the hard part;
  an in-memory fake would test nothing.
- Property-based tests (kotest / fast-check) on grade conversion round-trips and ordinal ordering,
  run against the shared spec on **both** sides so Kotlin and TypeScript can't diverge.
- Unit tests on flash-rate derivation and pyramid segmentation, including that Font and French
  ordinals never mix.
- Integration tests replaying a recorded offline session through the sync layer, including
  duplicate flush and partial failure.

### 8.6 Auth: OAuth2 via a backend-for-frontend

**OAuth2 only. No passwords, ever.** Google first; Apple or GitHub later if there's demand. A PWA
doesn't face the App Store rule forcing Apple sign-in, so Google alone is a legitimate launch.

**Spring Boot is the OAuth2 *client*, not just a resource server.** It performs the
authorization-code-with-PKCE exchange, holds provider tokens server-side, and hands the PWA an
`httpOnly` `SameSite` session cookie. The browser never sees an access token, so there's nothing
for XSS to steal and no refresh-token-in-JavaScript problem. `spring-boot-starter-oauth2-client`
covers it.

Four consequences that are easy to miss:

- **Same-origin deployment is a constraint.** Cookie sessions plus third-party cookie restrictions
  mean the PWA and API must share an origin. Handled by §9.3.
- **Sessions must be long-lived.** You log a session once or twice a week; a one-hour expiry
  forcing re-login at the wall would destroy the wedge. Target a sliding ~90-day server-side
  session.
- **Offline must never depend on auth.** Dexie is the source of truth, so logging works with an
  expired session — that's free from the architecture. But the sync queue must treat `401` as
  *pause and re-authenticate*, never a permanent failure that dead-letters the batch.
- **Identity is separate from user.** One person signing in with Google and later Apple must not
  become two accounts, and provider subject IDs are the join key. **Never key off email** —
  providers let users change it.

### 8.7 Monorepo layout

Codegen crosses the language boundary in both directions, so splitting repos would mean
version-pinning generated artifacts across them.

```
/
├── backend/              Gradle, Kotlin, Spring Boot, jOOQ
│   ├── src/main/resources/db/migration/    Flyway SQL — schema source of truth
│   └── build/generated/                    jOOQ classes (committed)
├── apps/web/             Vite + React PWA
├── packages/
│   ├── grade-spec/       versioned YAML + generators → Kotlin and TS (§8.4)
│   └── api-client/       TS client generated from OpenAPI (committed)
├── openapi.json          generated, committed
├── docker-compose.yml    local Postgres
└── justfile              single entrypoint over both toolchains
```

**Two ecosystems, one entrypoint.** pnpm workspaces for TypeScript, Gradle for Kotlin, a `justfile`
on top. Not Nx or Turborepo — neither manages Gradle well enough to earn its configuration here.

**Commit the generated code** — jOOQ classes, `openapi.json`, the TS client, generated grade
modules. Otherwise `pnpm dev` on the frontend requires Docker and a migrated Postgres just to
typecheck. CI regenerates and fails on drift, which is what keeps it honest.

**The codegen chain is the main monorepo cost.** Flyway migrate against a throwaway Postgres →
jOOQ codegen → build backend → emit OpenAPI → generate TS client → build web. Script it once, wire
the drift check into CI, and use path filters so a CSS change doesn't rebuild the JVM.

---

## 9. Hosting

**Cloud Run in `europe-north1` (Hamina, Finland) with scale-to-zero, plus Neon Postgres. Both
managed, ~€0/month, no server to own.**

Scale-to-zero is viable *because* the app is local-first: Dexie is the source of truth and sync is
a background outbox flush, so the user never waits on the network and a two-second cold start is
invisible. The only user-facing synchronous path is the OAuth redirect, handled by §9.2.

### 9.1 Cloud Run free tier covers Finland

Always-free monthly allowance on request-based billing: **2M requests, 180,000 vCPU-seconds,
360,000 GiB-seconds.** Unlike the Compute Engine and Cloud Storage free tiers — which are
US-region-only — the Cloud Run allowance is a spend-based discount at Tier 1 pricing, and
`europe-north1` is a Tier 1 region.

At single-digit users (~20k requests/month at 500 ms) that's roughly 5% of the allowance. Compute
is genuinely €0.

**Stay on request-based billing.** "CPU always allocated" moves you to instance-based rates at
~€43/month for 1 vCPU. The trade-off is that CPU is throttled between requests, so `@Scheduled`
jobs and async work stall — fine here, since this backend is entirely request-driven.

**Cap `max-instances` at 3–5.** Controls both cost and total database connection count.

### 9.2 Startup: JDK 25 AOT cache, not GraalVM

Spring Boot 4.x documents the **JDK 25 AOT cache** (Project Leyden, JEP 483) and recommends it over
the older CDS approach. Reported gains are ~3× from Leyden alone and ~4× combined with Spring AOT;
one published sample went **1.1 s → 0.27 s**. Fast enough for the OAuth redirect.

```
java -Djarmode=tools -jar app.jar extract
java -XX:AOTCacheOutput=app.aot -Dspring.context.exit=onRefresh -jar app.jar   # training run
java -XX:AOTCache=app.aot -jar app.jar                                          # runtime
```

Two caveats: it only works against the **extracted** jar, and the cache is invalidated by any
change to the application *or* the JDK version — so regenerate on every build and never commit it.

**Do not use GraalVM native image.** jOOQ isn't on GraalVM's ready-for-native-image list,
[jOOQ#8779](https://github.com/jOOQ/jOOQ/issues/8779) is still the open tracking thread, and there
are reported build failures around `DefaultRecordMapper` reflection substitutions. It would buy
65–500 ms startup instead of 270 ms, at the cost of 5–15 minute builds, ~20% lower peak throughput,
and real risk of getting stuck.

### 9.3 Database and domain

**Neon free tier:** 0.5 GB storage, 100 CU-hours/month, scale-to-zero after 5 minutes (not
disableable), 5 GB egress, 6-hour restore history. EU regions are Frankfurt and London only — no
Nordic region.

Neither limitation matters: 0.5 GB is millions of ticks (photos go to object storage, never
Postgres), and the Hamina→Frankfurt hop is invisible because nothing user-facing waits on it.

Configuration that matters:

- **Use the direct endpoint, not `-pooler`.** With `max-instances` capped, connection count is tiny,
  so PgBouncer buys nothing — and skipping it avoids transaction-mode restrictions on `SET`,
  `LISTEN`/`NOTIFY`, session advisory locks and SQL-level `PREPARE`. Use the direct endpoint for
  Flyway migrations regardless; pooled connections are documented as unsuitable.
- **If you ever move to the pooler, set `prepareThreshold=0`** on the PostgreSQL JDBC driver.
  Server-side prepared statements break under transaction pooling, and it's an unpleasant bug to
  diagnose.
- **HikariCP:** `minimumIdle=0` so the pool drains and Neon can suspend; `maximumPoolSize` ~5;
  connection validation on, with `maxLifetime` tuned to survive Neon compute restarts.

**Upgrade path:** if 0.5 GB or the region hop ever bites, Cloud SQL in `europe-north1` puts Postgres
in the same datacenter for ~€10/month — but note `db-f1-micro` is excluded from the SLA and
documented dev/test only; the cheapest SLA-covered tier is ~€45/month.

**Domain and TLS: use the free `*.run.app` URL.** Managed TLS, free, and since the JAR serves the
PWA from `src/main/resources/static/` it's same-origin for both app and API — so §8.6's cookie
session works with no extra configuration. This avoids Cloud Run's custom-domain mapping (still
Preview, serves TLS 1.0/1.1) and the ~€17/month global load balancer that is the GA alternative and
would cost more than the rest of the stack combined. Add a custom domain only when there are real
users, and price the load balancer in then.

**One thing would force that decision earlier and permanently: a Play Store listing.** The origin is
baked into every published APK, so it must be settled before the first one ships rather than when
users appear — see §10.2, which also concludes that the answer is Cloudflare rather than the load
balancer priced above.

### 9.4 Backups

Neon handles base backups and restore, but **the free plan's restore history is only 6 hours**,
which is thin for data you can't recreate.

So: a **weekly `pg_dump` to Cloudflare R2** (10 GB free, $0.015/GB after, zero egress at any
volume, so restore tests cost nothing), encrypted with `age` before upload, plus an automated
restore into a throwaway container followed by a sanity query. Alert on failure with a
dead-man's-switch ping (healthchecks.io free tier).

Roughly an hour of work, and the only backup responsibility left. **An untested backup is not a
backup** — the restore test is the part that determines whether you actually keep your logbook.

### 9.5 Costs that aren't zero

- **Artifact Registry free tier is 0.5 GB**, then $0.10/GB/month. A Spring Boot image is 250–400 MB,
  so this *looks* like a problem and mostly isn't: **OCI registries store layers by digest**, so the
  JRE base layer is stored once and each new tag adds only the changed application layer — tens of
  megabytes. Use Spring Boot layered jars or Jib and you stay inside the free tier indefinitely. A
  cleanup policy keeping the latest few tags is still worth setting, but even ten unshared 400 MB
  tags would cost $0.35/month. Cloud Run image pulls are free, since the destination is a Google
  product.
- **EU egress is billed from the first byte** — meaning there's no free allowance to consume, not
  that it's costly. GCP's always-free 1 GiB/month applies to North American regions only, so Hamina
  pays from byte one at **$0.12/GB** (Premium tier, the default; ~$0.085/GB on Standard). Egress is
  outbound response data; inbound requests are free.

  Magnitude: a tick as JSON is ~300 bytes, so a full re-sync of 2,000 ticks is ~600 KB, and 25 app
  launches a month is ~15 MB — around €0.002. Cents, but a real line rather than a zero.

  **The periodic full re-sync (§7.1) generates nearly all of the API share of it**, deliberately
  trading bandwidth for skipping a tombstone log. Free at this scale.

  **Do not move region to avoid this.** A North American region would grant the 1 GiB allowance and
  save ~€0.002/month, at the cost of: (a) moving EU personal data — OAuth identities, emails, venue
  geolocation — to a third country, requiring transfer safeguards and a privacy policy to match;
  (b) putting the Atlantic between Cloud Run and Neon-in-Frankfurt, since Neon has no Nordic region,
  which also consumes Neon's tighter 5 GB egress allowance; (c) slower analytics queries, which
  burn more of the vCPU-second allowance that actually matters.

  **If egress ever grows, the fix is Cloudflare in front of Cloud Run**, not a different region.
  The largest byte source is the PWA bundle rather than API JSON, and Cloudflare gives zero egress
  to users plus asset caching while preserving a single origin — so §8.6's cookie session keeps
  working and the data stays in Finland.
- **Cloud Build free tier is 2,500 build-minutes/month** — or build in GitHub Actions and just push
  the image, sidestepping it.
- Neon's 5 GB egress and 100 CU-hours *suspend* compute when exceeded rather than billing you.
  Worth a monitoring alert.

### 9.6 Deployment

GitHub Actions → build image (including the AOT training run) → push to Artifact Registry →
`gcloud run deploy`. Flyway runs on application startup.

**No Terraform.** One Cloud Run service, one Artifact Registry repo, one external database —
infrastructure-as-code here would be ceremony rather than engineering. Revisit if the resource
count grows past what you can hold in your head.

---

## 10. Distribution

**The PWA is the product. A Play Store listing is a channel for the same artifact, not a second
app.** That framing is what keeps the option cheap: a Trusted Web Activity adds no codebase, so
"maybe later" costs nothing today provided three things stay true (§10.5).

Nothing here is committed. The section exists so the option isn't foreclosed by accident — and
because one of its preconditions contradicts a decision already taken in §9.3.

### 10.1 The path: TWA via Bubblewrap

A **Trusted Web Activity** is an Android shell that renders your PWA in the user's installed Chrome
with no browser UI. The APK is roughly 800 kB, because it ships no rendering engine of its own — it
is a pointer at an origin. `bubblewrap` (Google Chrome Labs) generates and signs the project.

Its requirements are things the app needs regardless: an HTTPS origin, a web manifest, and a
registered service worker passing Chrome's minimum installability criteria.

**No second codebase, and no second release process for the product.** A web deploy updates the
Play build too, since the APK only points at the origin. The Android artifact needs rebuilding for
platform reasons (§10.3), never for feature work.

### 10.2 The custom domain is the real precondition

TWA proves you own the site it renders by fetching `/.well-known/assetlinks.json` from **the origin
baked into the APK**. That single fact collides with §9.3.

§9.3 chose the free `*.run.app` URL and deferred a custom domain until there are real users. **TWA
inverts that ordering.** Once an APK is published the origin is permanent: every install points at
it, and moving hosts means the asset-links file moves with them and every installed app breaks. You
cannot publish on a throwaway origin and tidy it up afterwards — and
`tickd-123456789.europe-north1.run.app` is not a URL to be married to.

**The answer is Cloudflare in front of Cloud Run**, which §9.5 already identified as the escape
hatch if egress ever grew:

- Free plan, managed TLS, a custom domain, and zero egress to users.
- **It preserves a single origin**, so §8.6's cookie session keeps working unchanged — the
  constraint that rules out most alternatives.
- Cost is domain registration, roughly €10–15/year. Nothing else in §9 changes.

Both GCP-native options are worse. **Cloud Run domain mapping is still Preview in 2026** — not
supported at GA, documented as not production-ready on latency grounds, and limited to a subset of
regions. The **global external Application Load Balancer** is the recommended production route at
~€17/month, more than the rest of the stack combined.

Serve `assetlinks.json` from the exact origin in the manifest, as `application/json`, with no
redirect. An apex-to-`www` redirect, or the reverse, is enough to fail verification.

### 10.3 The Play Console friction is not technical

This is what actually decides whether a listing happens, and none of it is code.

- **$25, one-time**, for the developer account.
- **Twelve testers, fourteen consecutive days.** Personal accounts created after 13 November 2023
  must run a closed test with at least 12 opted-in testers for 14 continuous days before applying
  for production access — reduced from 20 testers on 11 December 2024; organisation accounts and
  older personal accounts are exempt. Testers have to genuinely opt in and stay opted in, and
  dropping below 12 resets the window. A gym friend group is about the right size, which is
  convenient, but this is why publishing is not a quiet solo afternoon.
- **Your name and country become public.** The widely-circulated warnings about home addresses on
  Play apply to developers offering in-app purchases. tickd doesn't and won't, so this stays at
  name and country.
- **A privacy policy URL and a Data safety declaration are required.** With OAuth identities,
  emails and venue geolocation in the data these have to be real rather than boilerplate — but it
  is the same work as the GDPR obligations already owned in §8.2, not additional work.
- **The target-API treadmill is the recurring cost.** Play requires new apps and updates to target
  Android 16 (API 36) from **31 August 2026**, with extensions available to 1 November 2026, and
  the bar rises annually. A published TWA therefore needs rebuilding and resubmitting roughly once
  a year even when the web app hasn't changed; miss it and the listing stops being offered to new
  users. **That annual tax, not the $25, is the real price of a listing** — and it is a poor trade
  for an app nobody has asked for yet.

  Note that Bubblewrap's template was still on `targetSdkVersion 35` in mid-2026 with the deadline
  approaching, so "just regenerate" may not be sufficient. Check the template's target level rather
  than assuming it.

### 10.4 Two traps specific to this stack

**Play App Signing re-signs your APK, and the fingerprint in `assetlinks.json` must match the
re-signed key** — the SHA-256 from Play Console → Setup → App integrity, not the one from your local
keystore. Getting this wrong **fails silently**: the app launches with a browser address bar instead
of full-screen, which reads as a styling bug rather than a verification failure. It is the single
most common TWA defect. List both fingerprints while testing.

**First launch requires network, and offline-first does not save you.** The service worker can only
precache after one successful fetch, so §3's "offline is a requirement" protects every launch except
the first. Someone who installs from Play in a gym basement gets nothing. Not worth an architecture
change — worth knowing before blaming the service worker.

### 10.5 What changes now: nothing

No work in Phase 0–2, and a listing belongs with Phase 3 or 4 at the earliest, being the *public
product* half of §1's never-both-at-once.

Three things keep the option open, and all three are already required for other reasons:

1. **Keep passing installability criteria** — manifest, service worker, and the icon set in
   `DESIGN.md` §1, whose maskable and `apple-touch-icon` assets are the ones a TWA needs anyway.
2. **Stay single-origin** — §8.6 already requires it for cookie auth.
3. **Buy the domain before publishing, not after** (§10.2).

Explicitly not planned: Play Billing and the Digital Goods API (nothing is sold), Play-delivered
push notifications, and any native plugin bridge.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Feature creep kills Phase 0 | Phase 0 is ticking plus one analytic. Nothing else. Discipline here is the whole game. |
| Building for users who don't exist | You are user zero. If you don't use it daily, nobody will. |
| Sync underestimated | Budgeted at 2–3 weeks (§8.3), with the full checklist written down. |
| Local data eviction wipes the Phase 0 logbook | Accepted (§7.6). `persist()` plus manual export; a month of ticks is re-enterable. Raises the priority of Phase 1 sync. |
| Font and French ordinals conflated | Separate namespaces; shared UI component only (§7.3). |
| Outdoor experience is weak | Accepted deliberately. The Topo owns Finnish outdoor (§2). |
| Venue list quality decays with user submissions | `pending_review` plus `canonical_id` merges; volume is dozens, not thousands (§7.5). |
| Artifact Registry overage | Largely a non-issue: layer dedup plus layered jars keeps it inside the free tier, and the unmitigated cost is cents (§9.5). |
| Kotlin and TypeScript grade tables diverge | One versioned spec, codegen both sides, CI drift check (§8.4). |
| Duplicate accounts from multiple providers | `user_identity` from day one; never key off email (§8.6). |
| Grade model too rigid | Read-time conversion, versioned table, open and null grades handled (§7.3). |
| Route data legality (the Kaya trap) | Structurally impossible — tickd holds no route data (§7.2), and outdoor guidebook data is never planned (§5). |
| Social cold start | Phase 3, friend-group seeded (§4.4). |
| Photo/video storage cost | Local-first, aggressive compression, stays optional. |
| Play listing published on a throwaway origin | The origin is baked into every install. Decide the domain before the first APK, never after (§10.2). |
| Play listing goes stale and is delisted | An annual target-API rebuild is the standing cost of a listing. Accept it deliberately or don't publish (§10.3). |

---

## 12. Open questions

1. **Which Kiipeilyareena site**, and wall heights at both gyms? Needed for the seed rows and the
   vertical-metres metric.
2. **Does Tampereen Kiipeilykeskus also grade boulders in Font?** Kiipeilyareena does. If Tampere
   differs, `default_grade_scale` must be per-discipline per-venue rather than a single field.
3. **iOS and the App Store?** TWA is Android-only by construction, so §10 says nothing about iOS.
   Reaching it would mean Capacitor or similar — a second build target with a plugin bridge, which
   would also close the iOS haptics gap in `DESIGN.md` §4. Not planned, and not answered (D15).

---

## 13. Next step

Write the Phase 0 spec: screen-by-screen, the logging flow for rope *and* boulder, the Dexie schema
for `venue` / `session` / `tick`, the French and Font grade specs, and seed rows for both gyms. Then
build it. Phase 0 is small enough that having it running beats planning it further.

Scaffold the monorepo now even though Phase 0 only fills `apps/web` and `packages/grade-spec` — the
empty `backend/` directory costs nothing and stops Phase 1 from starting with a repo reshuffle.

---
---

# Decision log

Positions that were argued through and changed. Kept because the reasoning explains why the design
looks the way it does, and stops settled questions being reopened.

### D1 — Indoor-first; outdoor conceded

**Considered:** a general climbing logbook covering indoor and outdoor equally.

**Decided:** indoor is the product; outdoor works but is never a reason to choose tickd.

The Topo owns Finnish outdoor — 2,320 destinations, paywalled, Finnish company, revenue-shared to
authors. Competing means building a guidebook database from nothing or ingesting theirs, and Kaya's
2025 plagiarism controversy shows how the latter ends. Meanwhile Finnish *indoor* is unclaimed
because every incumbent requires the gym to buy software.

This also settled several downstream questions at once: it removed the last argument for a `route`
table (D2), reduced the grade scales needed (D5), and made "works at any gym with no integration"
the wedge rather than merely a convenience.

### D2 — No route entity; `route` merged into `tick`

**Considered, in order:** (a) routes identified by hold colour; (b) routes identified by the natural
key `(venue, grade, colour, sector, not retired)`; (c) anonymous ticks with an optional `route`
entity; (d) one merged `tick` table.

**Decided:** (d).

Every identity scheme failed for the same unfixable reason: **a newly set 6c+ in sector 4 is
indistinguishable from the 6c+ that used to be in sector 4.** No observable signal separates them,
and the gyms in question don't use colours as identifiers.

The resolution was to stop inferring. You already know whether you've climbed something — you're
standing in front of it — and flash-versus-redpoint was always a self-report the app could never
verify. None of the analytics ever needed route identity; they compute from
`(grade, protection, send_style, prior_experience, date)`.

**An earlier claim in this document was wrong:** that route identity had to exist from day one or
retrofitting would be painful. For indoor that was simply incorrect, since indoor routes should
never enter a shared library. For outdoor it held, but D1 made the cost irrelevant.

**What this eliminated:** the `route` table, natural-key matching and its escape hatches, route
dedup as a Phase 1 blocker, the grade snapshot (D4), all route lifecycle fields (D3), and the
per-gym "currently up" grid.

### D3 — Route lifecycle fields dropped entirely

**Considered:** `set_at` / `removed_at` on routes; then `first_seen_at` / `last_seen_at` written
automatically by the app, plus a "this sector was re-set" bulk action and a staleness window for a
derived "currently up" query.

**Decided:** none of it. The fields existed to keep a route inventory accurate, and D2 removed the
inventory. A tick records the grade you climbed on the day you climbed it, and that fact never
expires.

Worth noting the original `set_at` / `removed_at` were unimplementable anyway: nobody tells you when
a route was set or stripped, there's no gym API, and asking users to mark routes as stripped is
friction they'd never accept. "Gym ticklists rot within months" turned out to be a self-inflicted
problem.

### D4 — Corrections: plain `DELETE`, not tombstones

**Considered:** (a) append-only with supersede pointers and tombstones; (b) soft delete via
`deleted_at` plus last-write-wins; (c) ordinary `DELETE` and `UPDATE`.

**Decided:** (c).

The case for tombstones was the resurrection bug: you delete a tick on your phone, your laptop still
has it, and on next sync the laptop re-uploads it. **But that only happens if sync diffs local state
against the server**, and the design here is an outbox — a device pushes only operations it recorded
itself. The laptop never recorded creating that tick, so it has nothing to push. The bug was an
artifact of a sync design not in use.

The one real gap is that a hard delete leaves no trace for a long-offline device to learn from. The
textbook fix is a tombstone log; the cheap fix, at a few megabytes, is a periodic full re-sync on
app launch.

**A related item dissolved:** the grade snapshot (`grade_raw_at_tick`) was called the single most
important fix in the data model, because editing a route would retroactively move past ordinals.
D2 made it unnecessary — grade lives on the tick, so there is no route to edit. Structurally
impossible beats carefully handled.

### D5 — Grades: what's in, what's out

**Colour-only grading dropped** — the gyms in question tag numeric grades. This removed a
`venue_grade_set` entity with validity dates.

**Font and French are not the same scale.** It was suggested that Finnish gyms grade boulder and
rope identically, which would have allowed one shared ordinal namespace. They don't: Kiipeilyareena
grades boulders on **Fontainebleau** (uppercase `6A`), having switched to it explicitly. Font `6A`
and French `6a` look nearly identical and mean very different things. The *UI* can be one shared
grid component; the *data model* must keep two namespaces or every pyramid is corrupted.

**Scale count reduced.** Earlier drafts required five native scales from day one — French, Font,
Finnish, Scandinavian, UIAA. D1 deferred all but French and Font, since the rest matter only
outdoors.

**8a.nu CSV import dropped** — no logbook to migrate, and it would only ever help people already on
8a.

### D6 — Style: two fields, not one flat enum

**Considered:** the 8a.nu convention, a single enum of
`onsight | flash | redpoint | second_go | toprope | repeat`.

**Decided:** split into `protection` (lead / toprope / autobelay / none) and `send_style` (onsight /
flash / redpoint / second_go), plus a repeat flag — later widened to the three-value
`prior_experience` (D14).

The flat enum forces `toprope` into the same slot as `flash`, so a toprope flash and a toprope
redpoint are indistinguishable. Indoors, lead-versus-toprope is the *primary* quality axis, so that
discards the most interesting signal in the data. `protection = none` then separates boulder from
rope for free.

**On auto-belay:** the alternative was excluding auto-belay laps from pyramids by default, since
they're usually volume on easier terrain. Decided instead to **segment everything and exclude
nothing** — aggregating across categories is what misleads, and dropping data is its own distortion.

### D7 — Phase 0 backup dropped, and with it the Phase 1 claim path

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

### D8 — Hosting: the "no scale-to-zero" requirement was wrong

**Considered, in order:** Supabase; then an always-on VPS (Hetzner Helsinki €6/mo, UpCloud Helsinki
€15/mo with managed Postgres); then hyperscalers; then Cloud Run with scale-to-zero.

**Decided:** Cloud Run `europe-north1` scale-to-zero + Neon, ~€0.

The requirement that ruled out serverless was "JVM cold starts of several seconds would hit the sync
endpoint." **That was wrong, and it was the single constraint forcing an always-on server.** The app
is local-first: sync is a background outbox flush, so the user never waits on the network and a
two-second cold start is invisible. The only user-facing synchronous path is the OAuth redirect,
which the JDK 25 AOT cache handles (0.27 s in a published sample).

Two contributing facts: Cloud Run's free tier **does** cover `europe-north1` (unlike the Compute
Engine and Cloud Storage free tiers, which are US-only), and Hetzner's cheap CX line turned out to be
supply-constrained and unavailable, after two 2026 price rises.

**Neon was rejected and then adopted**, which is worth recording. The objection was real: HikariCP
holds open connections, so on an always-on server Neon never scales to zero and burns ~182 CU-hours
against a 100-hour free allowance. On Cloud Run the *instance* scales to zero, so the pool
disappears with it and the two idle in step. The mismatch was an artifact of the always-on
assumption, not of Neon.

### D9 — Backend: Kotlin over Node, twice

**Considered:** Supabase (rejected in favour of owning the backend); then Node + Kysely + Neon on
Vercel, raised twice — once for interest and once explicitly to solve hosting.

**Decided:** Kotlin + Spring Boot + jOOQ.

The technical argument is that the analytics pillar is SQL-shaped — window functions, lateral joins,
`percentile_cont` — which is exactly jOOQ's sweet spot. Kysely is a healthy, genuine analogue
(0.29.2, May 2026, native window functions and CTEs) but `percentile_cont` needs a raw `sql` tag,
and jOOQ remains better here.

**The Node stack's cost advantage evaporated with D8.** Once scale-to-zero was on the table, Kotlin
on Cloud Run is also ~€0 with no ops. What remained were a simpler monorepo — one toolchain, and
§8.4's dual grade-spec codegen collapsing to one shared package — and a faster path to Phase 1. Real
advantages, but not decisive.

Also relevant: Vercel Hobby prohibits commercial use, explicitly including "being paid to
create/update/host the site" and even asking for donations, so Phase 3 as a real product would need
Pro at $20/month per developer.

The frontend, data model, grade spec and sync design are all backend-agnostic, so this stays cheap to
revisit.

### D10 — Quarkus considered, declined

**Considered:** Quarkus instead of Spring Boot, prompted by image size against Artifact Registry's
0.5 GB free tier.

**Decided:** stay on Spring Boot. Not because Quarkus is worse — it's a good framework — but because
nothing here is a problem it solves.

- **Image size isn't a real constraint.** Layer deduplication plus layered jars keeps you inside the
  free tier, and the unmitigated cost is cents (§9.5). If image size ever mattered, the fix is
  layered jars → distroless base → jlink-trimmed JRE, not a framework change.
- **Startup is already solved.** The JDK 25 AOT cache gets Spring Boot to 0.27 s, which neutralises
  Quarkus's main JVM-mode advantage.
- **Quarkus's biggest advantage — clean native image — is blocked by jOOQ, not by Spring.** The
  reference build failure is literally `quarkus-jooq#177`, and jOOQ isn't on GraalVM's
  ready-for-native-image list regardless of framework, because `DefaultRecordMapper` relies on
  reflection. Switching frameworks does not open the native path.
- Lower memory footprint is a genuine Cloud Run advantage (GiB-seconds), but usage is ~5% of the
  free allowance, so nothing is squeezed.

Quarkus would be the right call if you dropped jOOQ for Hibernate/Panache and wanted native. But
jOOQ *is* the reason the backend was chosen (D9) — the analytics are window functions and
`percentile_cont`. That trade runs the wrong way.

### D11 — Not a portfolio artifact

Earlier drafts optimised for CV legibility, which justified Terraform, GraalVM native image, and
hand-rolled Postgres backups as things that "read well to reviewers".

**Decided:** the goal is to build it well and use it, not to get hired. So: no Terraform (one
service, one registry, one database), no GraalVM (jOOQ isn't native-ready), and managed Postgres
rather than owned backups.

Worth recording the general point, since it drove a lot of earlier reasoning: nobody is impressed by
*which invoice you pay*. What reads well is CI/CD, migrations on deploy, health checks, structured
logs and a documented cost model — all of which are demonstrable on a €6 VPS.

### D12 — Smaller merges and simplifications

- **`attempt` merged into `tick` via `is_send`.** An attempt is a tick you didn't send: same shape,
  one boolean. One fewer table, and Phase 0 captures attempts for free.
- **`project` is a grouping key, not a route.** It only needs to link attempts to a send, and you
  create it by naming it, so identity is unambiguous. Phase 2.
- **`canonical_id` survives on `venue` only.** Merge pointers existed for route dedup (D2); venues
  still need them, at a volume you can moderate by hand.
- **Venues are curated plus user-submitted**, not free-form. Free-form would produce fifteen
  spellings of the same gym; pure curation would block anyone whose gym isn't listed, breaking the
  "any gym" promise from D1.
- **Venues are locations, not brands** — Kiipeilyareena's sites have different wall heights, which
  the vertical-metres metric depends on.

### D13 — Estimates, as revised

| | Original | Now | Why |
|---|---|---|---|
| Phase 0 | "a few weeks" | ~4–6 weeks | Grew with durability work and five grade scales, then shrank further as D2/D3/D5/D7 removed the route entity, dedup, migrations, backups and three scales. |
| Phase 1 | ~4–6 weeks | ~6–8 weeks | Owning auth and hosting (D9) added more than managed hosting (D8) removed. Sync is 2–3 weeks of it. |

### D14 — Flash rate divides by first encounters, not by sends

**Considered:** the denominator this document originally specified in §7.7 — "pyramids and flash rate
filter `is_send = true`" — making flash rate *flashes ÷ sends at that grade*.

**Decided:** *flashes ÷ first encounters*, where a first encounter is any tick with
`prior_experience = none`, sent or not.

**The sends-only filter is biased upward exactly where the metric is read.** Ten different 7a's — one
flashed, one redpointed after three goes, eight abandoned without ever sending — gives 1 ÷ 2 =
**50%**, reading as "7a is your level", against a true 1 ÷ 10 = **10%**. Easy grades are barely
affected, since nearly everything you get on there is a send, so the curve flattens at the top and
pushes the 50% crossing upward. That crossing is the one number the metric exists to locate, so the
flagship analytic was measuring itself wrong.

Counting attempt *rows* instead fails in the other direction — those eight routes might be twenty
attempt rows, giving 4.5% — and grouping rows by `(date, venue, sector, grade)` to approximate
"routes" miscounts both ways: one route worked over three sessions becomes three failures, while
three different 7a's failed in one session in one sector collapse to one. It would also quietly
reintroduce, in the analytics layer, the identity inference D2 removed from the data model.

**The fix is D2's own argument applied to analytics: stop inferring and ask.** You know whether you
have touched a route before, because you are standing in front of it. Recording that as
`prior_experience` gives an exact denominator with no route entity, no grouping heuristic and no
dedup — and it subsumes the repeat flag from D6 rather than adding a field alongside it.

**What this changed:** the repeat boolean became `prior_experience`; `send_style` became nullable,
since it is meaningless on an attempt; the §7.7 note about filtering `is_send = true` was corrected;
and `DESIGN.md` §5 lost its last-used `send_style` default, because a sticky `redpoint` would
silently relabel every subsequent tick and corrupt the flagship metric rather than merely being
untidy.

### D15 — Play Store is a channel, not a rewrite

**Considered:** a native Android app; Capacitor wrapping both stores; a TWA; no store presence at
all.

**Decided:** a TWA if and when a listing happens, and no commitment now (§10).

A native app contradicts the whole local-first PWA architecture and would mean maintaining the
logbook twice. **Capacitor is the serious alternative:** it wraps any HTTPS URL in its own bundled
WebView — ~4 MB against a TWA's ~800 kB — and adds a plugin bridge, which buys the App Store and
native APIs, including the iOS haptics that `DESIGN.md` §4 currently records as unavailable. That
is a real advantage, but it costs a second build target and a second store relationship for a
product with no users, so it is the right thing to revisit if iOS distribution ever becomes a goal
rather than the right thing to choose now.

**The finding that matters is that the wrapper is not the binding constraint.** The two things that
decide whether a listing is worth having — a permanent custom domain fixed *before* publication
(§10.2), and an annual target-API rebuild for as long as the listing exists (§10.3) — apply
identically to every option on the list. Choosing TWA is the easy part; the cost is elsewhere.

**What this changed:** §9.3's "add a custom domain only when there are real users" gained an
exception, since a Play listing forces the decision earlier and makes it irreversible.

### A note on cost estimates in this document

Two line items — EU egress and Artifact Registry storage — were initially written up as things to
watch, and both turned out to be worth cents per month. They're kept in §9.5 for completeness, so
"~€0/month" isn't misread as literally zero, but neither is a reason to change any design decision.
If a future cost concern appears, price it before acting on it.

---

## Reference: hosting alternatives priced

Kept because the research was expensive and the numbers may be useful again. **All priced against
an always-on requirement that D8 retired** — read the column as "cost if you wanted a server running
24/7". Verified July 2026.

| Option | Region | €/mo | Notes |
|---|---|---|---|
| **Cloud Run scale-to-zero + Neon free** | **Hamina, FI** | **€0** | **Chosen.** |
| Hetzner CX23 + Postgres in Docker | Helsinki | €6 | Cheapest always-on. Currently out of stock. |
| Hetzner CX33 + Coolify + Postgres | Helsinki | €9 | Buys git-push deploys, Traefik, auto-TLS. |
| UpCloud Starter 4 GB, self-hosted PG | Helsinki | €12 | Finnish company, IPv4 and egress included. |
| Render Starter + Postgres Basic | Frankfurt | €12 | Low ops, but 512 MB is tight for Spring Boot 4.1. |
| Cloud Run + Cloud SQL | Hamina, FI | €14–17 | The always-on GCP variant. |
| UpCloud Starter 2 GB + Managed PG | Helsinki | €15 | Managed PITR, 99.99% SLA. |
| Railway | Amsterdam | €15–20 | Good DX, drifts over budget. |
| AWS Lightsail container + managed DB | Stockholm | €23–28 | The budget AWS path. |
| Azure App Service B1 + Flexible Server | Sweden Central | €24–26 | Best free first year. No Finland region. |
| AWS Fargate + ALB + RDS | Stockholm | €50–60 | ALB €16 + IPv4 €7 unavoidable. |
| Fly.io Machine + Managed Postgres | Stockholm | €40 | Out. MPG starts at $38 and isn't in `arn`. |

**Traps found along the way:**

- **Cloud SQL `db-f1-micro` has no SLA** and is documented dev/test only. Cheapest SLA-covered tier
  is ~€45/mo.
- **AWS's free tier changed in July 2025** to credit-based ($100 + up to $100, ending at 6 months).
  The 750-hour 12-month EC2/RDS allowances are legacy accounts only.
- **ACM certs can't attach to EC2**, only to ELB/CloudFront/API Gateway — which is why the ALB fee
  is hard to dodge.
- **Aurora Serverless v2 supports MinCapacity=0**, but resume takes ~15 s, 30 s+ after a day idle.
- **Hetzner raised prices twice in 2026** (April and 15 June), so most third-party pricing pages are
  stale. The Cost-Optimized line is supply-constrained; the CPX22 fallback rose 144% to €19.49.
- **No provider offers a usable always-available free Postgres in 2026.** Neon can't disable
  scale-to-zero, Supabase pauses after a week idle, Aiven's free tier powers off on inactivity,
  Render's free database expires at 30 days.
