## 1. Correct the premise in the design documents

- [x] 1.1 `CONCEPT.md` §1 summary table: the Grades row says "French for rope, Fontainebleau for
      boulder" — restate as separate notations with separate ordinal namespaces
- [x] 1.2 `CONCEPT.md` §7.3: the two scale bullets say "for rope" and "for boulder"; replace with which
      venues use which, and state that a scale does not imply a discipline
- [x] 1.3 `CONCEPT.md` §7.3: add that Tampere grades boulders in French, so one discipline spans two
      scales and one scale spans two disciplines
- [x] 1.4 `CLAUDE.md`: the invariant reads "Font `6A` (boulder) and French `6a` (rope)" — reframe as
      Font-versus-French, and name the two separation layers and what each is responsible for
- [x] 1.5 `packages/grade-spec/scales.yaml`: the `# French, for rope` and `# Fontainebleau, for boulder`
      section comments

## 2. The metric segmentation key

- [x] 2.1 `CONCEPT.md` §4.2: "Segment, never exclude" gains `grade_scale` alongside `protection`
- [x] 2.2 `CONCEPT.md` §4.2: state that two scales for one discipline produce two distributions, and
      that merging them needs the deferred conversion table
- [x] 2.3 Check §4.2's pyramid bullet ("per discipline and per `protection`") for the same gap

## 3. Close the open questions

- [x] 3.1 `CONCEPT.md` §12: mark Q2 answered — Tampere grades boulders in French
- [x] 3.2 `CONCEPT.md` §12: check whether Q1 (Kiipeilyareena site, wall heights) is affected; it is not,
      but confirm rather than assume
- [x] 3.3 `DESIGN.md` §5: replace the grid-direction open question with the decision, easiest-at-top,
      and the reasoning
- [x] 3.4 `apps/web/DEPLOY.md`: record that the PWA was installed from Android Chrome, so that is the
      IndexedDB holding real ticks and Samsung Internet stays off-limits for the trial

## 4. The decision log

- [x] 4.1 Add **D17** to `CONCEPT.md`: scales are notations not disciplines; what was considered
      (`french_boulder`, a conversion table, one merged pyramid) and why each was rejected or deferred
- [x] 4.2 Record the accepted cost — two boulder pyramids — and what would reverse it
- [x] 4.3 State that D5 stands and only an implication read into it was wrong
- [x] 4.4 Update both documents' `Last updated:` lines

## 5. Verify

- [x] 5.1 Grep for `for rope`, `for boulder`, `(boulder)` and `(rope)` near `french`/`font` and confirm
      no stale claim survives anywhere, including files not listed above
- [x] 5.2 Run `just codegen-check` to confirm the `scales.yaml` comment edits changed no generated output
- [x] 5.3 Run `just check` and confirm it passes with no code changes
- [x] 5.4 Re-read the `grade-scales` delta against the corrected documents and confirm they agree
