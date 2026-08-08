## 1. Apply the model corrections (D18–D21)

- [ ] 1.1 Drop `send_style` from `types.ts`; `TickOutcome` stops being a union and becomes
      `{ is_send: boolean; prior_experience: PriorExperience }`
- [ ] 1.2 Drop `attempts`, `sector`, `high_point` and `venue_id` from the tick; drop `conditions` and
      `felt` from the session
- [ ] 1.3 Add `angle` as a single-valued enum and `holds` as an array; remove `tags`
- [ ] 1.4 Remove the `venue_id` index from the `ticks` store definition
- [ ] 1.5 Add `sendStyleOf(tick)` deriving `flash` / `redpoint` / none from `is_send` and
      `prior_experience`, with the reasoning at the definition
- [ ] 1.6 Update `STORED_FIELDS` so the exhaustive check passes, and record the new `SCHEMA_MARKER`

## 2. Rewrite the assertions for a model with nothing left to contradict

- [ ] 2.1 Delete the style assertions from `types.assert.ts` — the combinations they forbid are no longer
      representable, so the directives would report as unused
- [ ] 2.2 Assert all six `(prior_experience, is_send)` combinations are valid, so a future narrowing is a
      build failure
- [ ] 2.3 Keep and re-verify the grade/scale, discipline/protection and venue-scale assertions, which are
      unaffected
- [ ] 2.4 Update `TickDeclaresKey` assertions to cover the newly dropped columns
- [ ] 2.5 Rewrite `writes.assert.ts` the same way, keeping the insert-type assertions that prove the table
      typing has not regressed
- [ ] 2.6 Verify by planting: widening the outcome type must fail 2.2, and reverting the table typing to
      `EntityTable` must still fail the insert-type assertions

## 3. Tests for the reduced model

- [ ] 3.1 Test `sendStyleOf` across all six combinations
- [ ] 3.2 Test that flash rate's numerator and denominator can be computed from `is_send` and
      `prior_experience` alone, including a first encounter that was never sent
- [ ] 3.3 Test the round trip of `angle` and `holds`, including absent
- [ ] 3.4 Update the existing schema and seed tests for the new tick shape
- [ ] 3.5 Confirm `SCHEMA_MARKER` moved, and that the derived-marker test caught it rather than a human

## 4. Documentation catches up with the model

- [ ] 4.1 `CONCEPT.md` §7.4 — the style block becomes two fields; remove the invalid-combination rules and
      the four-goes example that assumed a tick spans several goes
- [ ] 4.2 `CONCEPT.md` §7.2 — rewrite the identity tuple: no `sector`, no `send_style`, venue via session
- [ ] 4.3 `CONCEPT.md` §7.7 — update the `tick` and `session` blocks
- [ ] 4.4 `CONCEPT.md` §6 — `onsight` no longer stays in the model for outdoor use, because the enum is gone
- [ ] 4.5 `CLAUDE.md` — rewrite the style invariant: it is no longer three orthogonal fields with two
      invalid combinations, and the UI no longer *makes* anything unreachable
- [ ] 4.6 Update the `Last updated:` lines

## 5. Session lifecycle

- [ ] 5.1 Session start: create a session at the chosen venue, with the last venue preselected
- [ ] 5.2 Location as an ordering hint only — never blocking, never required, usable when denied
- [ ] 5.3 Explicit end with `ended_at` at the moment of ending
- [ ] 5.4 Lazy close on launch keyed on **idle since last tick**, not date change, with `ended_at` set to
      the last tick's timestamp
- [ ] 5.5 Delete zero-tick sessions on close, both paths
- [ ] 5.6 Announce a lazy close rather than closing silently
- [ ] 5.7 Tests: idle close, midnight does **not** close, `ended_at` is never the reopen time, zero-tick
      deletion

## 6. The grade grid

- [ ] 6.1 Render the full scale easiest-first, in storage order, from `@tickd/grade-spec`
- [ ] 6.2 Compute the working range as `[min − 2 … max + 2]` over 90 days, per `(discipline, grade_scale)`,
      over all ticks rather than sends only
- [ ] 6.3 Set the initial scroll position from the range — before paint, not animated
- [ ] 6.4 Recompute on mount and on discipline change; **not** after each tick
- [ ] 6.5 Day one: no range, no repositioning, grid starts at the easiest grade
- [ ] 6.6 Never apply a case transform to a grade label anywhere in the grid
- [ ] 6.7 Tests: range excludes the other scale's ticks, outliers behave as documented, day one is quiet

## 7. Discipline and protection

- [ ] 7.1 Discipline mode selects the venue's scale for that discipline
- [ ] 7.2 Offer only disciplines the venue provides — a boulder-only venue shows no rope option
- [ ] 7.3 Boulder forces `protection: 'none'` and hides the control
- [ ] 7.4 Sticky `protection` for roped disciplines, always visible
- [ ] 7.5 Tests against the seeded venues, including Lielahti having no rope mode

## 8. The outcome grid and the write

- [ ] 8.1 Build the 3×2 control with nothing preselected and no carry-forward
- [ ] 8.2 Write the tick on the cell tap — no confirm, no submit
- [ ] 8.3 Touch targets at 48–56 px and the primary controls within the lower thumb-reachable third
- [ ] 8.4 Tests: two taps produce a tick; nothing is preselected; the previous choice does not persist

## 9. Undo and annotation

- [ ] 9.1 Recent-ticks list for the current session, showing grade, protection, prior experience and
      whether it was sent
- [ ] 9.2 Persistent removal, not a timed notification
- [ ] 9.3 Annotation of a written tick via `update` — `notes`, `angle`, `holds`, `rating`,
      `grade_opinion`, `length_m`
- [ ] 9.4 Reach annotation from the recent list as well as immediately after logging
- [ ] 9.5 Tests: a tick several entries back is still reversible; annotation never blocks logging

## 10. Verify

- [ ] 10.1 `just check` exits 0
- [ ] 10.2 Confirm the Phase 0 scope fence still holds — no HTTP, auth or sync dependency, no router
- [ ] 10.3 Confirm the invariants that remain are still enforced, by planting failures rather than reading
      the code
- [ ] 10.4 Log a full session end to end against the seeded venues, including a boulder-only one
- [ ] 10.5 Record in the commit message what was verified against what broken state — and state plainly
      why deleting the style assertions strengthens the guarantee rather than weakening it
