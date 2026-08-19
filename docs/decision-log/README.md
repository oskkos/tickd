# Decision log

One file per decision. These are positions that were **argued through and changed** — not a record of
every choice made, but of the ones where the obvious answer turned out to be wrong. `CONCEPT.md` holds
the index; this file holds the convention.

Read the relevant entry before proposing an alternative. Most obvious-seeming suggestions — a `route`
table, colour-coded grades, one flat style enum, an always-on VPS, Quarkus, GraalVM, Terraform, 8a.nu
CSV import, a native mobile app, `react-router`, TanStack Query, a charting library — were already
considered and rejected here, with reasoning.

## The number is the key, and it never changes

A decision is cited as `D17` from code comments, from the capability specs under `openspec/specs/`, and
from `CLAUDE.md`. Those citations are the reason the numbering is stable:

- **Never renumber.** A decision keeps its number for the life of the repo.
- **Never delete.** A decision that stops being true is marked, not removed — see `status` below.
- **Never split an existing entry into two numbers.** D5 and D12 each bundle several related rulings
  precisely because they were argued as a bundle, and re-keying them would invalidate live citations.

New decisions are appended with the next free number. Add a row to `CONCEPT.md`'s index in the same
commit, or the entry exists without being reachable.

## Filenames

`NN-subject.md`, where `NN` is the zero-padded number and the subject is a short slug of the title:

```
17-a-scale-is-a-notation-not-a-discipline.md
20-a-tick-is-one-go-send-style-derived.md
```

Zero-padded so the folder sorts chronologically, and named for the subject so the listing reads as a
table of contents rather than as a directory of `d17.md`.

## Frontmatter

Every entry carries the same four or five fields:

```yaml
---
id: D17                                        # the citable key
title: A scale is a notation, not a discipline # matches the h1 below it
status: accepted                               # accepted | amended | superseded
amended_by: [D16]                              # only when something later changed part of it
related: [D5]                                  # every other decision this one touches
---
```

- **`status`** is `accepted` for everything currently in force. `amended` means a later decision
  changed *part* of it and the rest stands; `superseded` means it no longer holds at all. Prefer
  amending a live entry's status over rewriting its body — the body is the historical argument, and
  editing it destroys the thing the log exists to keep.
- **`related`** is derived from the decisions the body actually cites, plus any amendment link. It is
  navigation, not argument.

## Body

The heading is `# Dn — Title`, repeating the frontmatter title so the file reads on its own.

Below it, these sections **where the content exists** — the structure is a shape to reach for, not a
form to fill in:

| Section | What it holds |
|---|---|
| **Considered** | The options that were on the table, including the ones that lost. |
| **Decided** | What was chosen, in a sentence or two. |
| *Free-form* | The reasoning. Usually bold-led paragraphs, one per argument. This is the bulk. |
| **What this changes** | The sections, capabilities and files the decision moves. |
| **What would reverse it** | The condition under which this should be revisited. |

**Do not manufacture a section that has no content.** D5, D12 and D13 have no `Considered` block
because none was recorded when they were written, and inventing one would be inventing history. An
absent section is honest; a section reading "not recorded" is scaffolding.

`What would reverse it` is the most valuable of the five and the most often missing. A decision without
it reads as permanent, which is how settled questions get reopened by someone who cannot tell whether
the reasoning still applies.
