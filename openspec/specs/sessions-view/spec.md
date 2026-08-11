# sessions-view

## Purpose

Reading a logbook back. The logging screen writes; this capability is where a climber returns to what was
written — every visit newest first, and every go within a visit with whatever was noted about it.

It exists because the annotation fields were otherwise write-only: `notes`, `rating`, `grade_opinion`,
`angle`, `holds` and `length_m` are collected by the tick sheet and, before this, could be read only
while the session that produced them was still open. Phase 0's exit criterion is logging every session
for a month and reaching for nothing else, which a logbook you cannot read back does not meet.

Two surfaces with different jobs, which is why they disagree on purpose. A **card** is a glance surface:
it shows one pill per go rather than a per-grade tally, because rolling a flash and a fall at one grade
into `6b ×2` discards the distinction the outcome model exists to record — and it groups its pills by
`(discipline, grade_scale)`, the same pair every metric groups by, because Font `6A` and French `6a`
differ only by letter case. A **detail** is a reading surface: chronological and interleaved, since the
sequence of a visit is the thing worth keeping, with each go's protection naming its own discipline.

What it deliberately does not do: no analytic of any kind (flash rate has its own screen, volume metrics
are Phase 1), no deletion (undo stays session-scoped, for mis-taps at the wall), and no editing of
`prior_experience` or `is_send` — the sheet reaches the annotation fields only, and that gap is stated
rather than implied away.

## Requirements

### Requirement: Sessions are listed newest first, including the one still open

The Sessions view SHALL list every session in the database ordered by `started_at` descending. An open
session — one with no `ended_at` — SHALL appear at the top, marked as still running. Sessions SHALL NOT
be grouped or bucketed by week or month; the list is one card per visit.

#### Scenario: Closed sessions appear newest first

- **WHEN** the Sessions view is opened with three closed sessions in the database
- **THEN** they are listed with the most recently started first

#### Scenario: The open session is listed and marked

- **WHEN** the Sessions view is opened while a session is running
- **THEN** that session appears first and is visibly distinguished from the closed ones

#### Scenario: A discarded session leaves no card

- **WHEN** a session that recorded no ticks was ended
- **THEN** no card exists for it, because the row was deleted rather than closed

### Requirement: A session card shows one pill per go, never a tally by grade

Each card SHALL render one pill per tick in the session, in the order the goes happened, each pill
carrying the grade verbatim and a mark for how the go ended — flash, sent, or not sent. Goes SHALL NOT
be aggregated into per-grade counts.

Aggregating discards the distinction between a flash and a fall at the same grade, which is the
distinction the outcome model exists to record. The card is a glance surface, so the loss would be
unrecoverable unless the per-go truth is reachable, and the detail view is what makes the pills
sufficient rather than merely compact.

#### Scenario: Two goes at one grade with different outcomes stay distinct

- **WHEN** a session contains a flash at `6b` and a failed go at `6b`
- **THEN** the card shows two pills, marked differently, rather than one pill reading `6b ×2`

#### Scenario: Grade text is never transformed

- **WHEN** a pill renders a grade label
- **THEN** the label appears exactly as stored, with no change of letter case

#### Scenario: A flash is marked distinctly from an ordinary send

- **WHEN** a card shows a flashed go and a redpointed go
- **THEN** the two carry different marks, and the mark is not conveyed by colour alone

### Requirement: Pills group by discipline and scale when a session spans more than one

When a session's ticks cover more than one `(discipline, grade_scale)` pair, the card SHALL group its
pills by that pair and label each group with its discipline and notation. When every tick shares one
pair, the card SHALL show a single ungrouped run of pills and no group label.

Font `6A` and French `6a` differ only by letter case. A visit that ropes and boulders at a venue
grading the two in different notations would otherwise place them adjacent and unlabelled, presenting
values from separate ordinal namespaces as one sequence.

#### Scenario: A mixed session is split by discipline and notation

- **WHEN** a session contains French-graded roped ticks and Font-graded boulder ticks
- **THEN** the card shows two labelled groups, each naming its discipline and its notation

#### Scenario: A single-discipline session carries no group label

- **WHEN** every tick in a session shares one discipline and one scale
- **THEN** the pills render as one run with no group heading

#### Scenario: One scale serving two disciplines still splits by discipline

- **WHEN** a session at a venue grading both disciplines in French contains roped and boulder ticks
- **THEN** the card splits them by discipline, because a shared notation does not make the grades
  comparable

### Requirement: A card states the session's own facts and computes no metric

Each card SHALL show the session's local date, its start time, its duration, its tick count, its
venue's name, and the protections its ticks used. It SHALL NOT show vertical metres, a flash rate, or
any other analytic.

Wall heights are seeded absent, so vertical metres cannot be computed; volume metrics belong to Phase 1;
and Phase 0 ships exactly one analytic, on its own screen.

#### Scenario: No vertical-metres figure appears

- **WHEN** the Sessions view is rendered
- **THEN** no vertical distance is displayed, in the list header or on any card

#### Scenario: Start time distinguishes two sessions on one day

- **WHEN** two sessions were started on the same local date
- **THEN** each card shows its start time, so the two are told apart

#### Scenario: The open session's duration runs from its start to now

- **WHEN** a card is rendered for a session with no `ended_at`
- **THEN** its duration is measured from `started_at` to the present moment

### Requirement: Duration claims no more precision than the data carries

The duration shown SHALL be derived from `started_at` and `ended_at` alone. The view SHALL NOT
distinguish a session ended explicitly from one closed lazily, and SHALL NOT annotate a duration as
approximate.

A lazily closed session's `ended_at` is its last tick's `created_at`, so its duration systematically
omits whatever happened after the final go. No field records which path closed a session, so the
distinction is not available to display, and inventing one would require a schema field this phase
does not need.

#### Scenario: A lazily closed session shows first-tick-to-last-tick

- **WHEN** a session was closed by the idle backstop
- **THEN** its card shows the duration implied by its stored timestamps, unqualified

### Requirement: A session opens its detail, except the one still running

Tapping a closed session's card SHALL open that session's detail view. Tapping the open session's card
SHALL navigate to the logging screen instead.

The open session's useful action is resuming it, not reviewing it — and the logging screen already
lists its goes with undo attached.

#### Scenario: A closed session opens its detail

- **WHEN** a closed session's card is tapped
- **THEN** the session detail view for that session is shown

#### Scenario: The open session returns to logging

- **WHEN** the open session's card is tapped
- **THEN** the logging screen is shown, with that session still open

### Requirement: The detail view lists every go in chronological order with everything it carries

The session detail view SHALL show the venue, the local date, the start and end times, the duration,
and counts of ticks, sends and flashes — then every tick in the session ordered by `created_at`
ascending, oldest first.

Each go SHALL show its time, its grade verbatim, its outcome mark, its protection, and its prior
experience. It SHALL additionally show `angle`, `holds`, `rating`, `grade_opinion`, `length_m` and
`notes` when those are present, and SHALL omit each when absent.

Chronological order rather than grouping by discipline: the detail is the session's sequence, and
grouping would hide that the climber moved to the boulder wall after failing a route. Ordering is
oldest-first for the same reason the summary is, while the recent-ticks list stays newest-first
because its job is undo.

#### Scenario: Goes appear oldest first

- **WHEN** a detail view is opened for a session with several ticks
- **THEN** the goes are listed in the order they were logged, earliest at the top

#### Scenario: A go with no annotation occupies one line

- **WHEN** a tick carries no angle, holds, rating, opinion, length or notes
- **THEN** its row shows only time, grade, outcome, protection and prior experience

#### Scenario: Every stored annotation is displayed

- **WHEN** a tick carries notes, a rating, a grade opinion, an angle, holds and a length
- **THEN** all six appear in that go's row

#### Scenario: A mixed session stays interleaved

- **WHEN** a session's roped and boulder goes alternate in time
- **THEN** the detail lists them interleaved rather than sectioned by discipline

### Requirement: A go's discipline is read from its protection

A detail row SHALL name the go's protection for a roped tick, and the word `boulder` for a tick whose
protection is `none`.

`protection: 'none'` is what boulder means, so one field answers both questions and no second field
can contradict it. It also disambiguates the notation without a scale label: `6a+ toprope` and
`6A boulder` cannot be confused.

#### Scenario: A roped go names its protection

- **WHEN** a detail row renders a tick with protection `toprope`
- **THEN** the row shows `toprope`

#### Scenario: A boulder go names the discipline

- **WHEN** a detail row renders a tick with protection `none`
- **THEN** the row shows `boulder` and shows no protection value

### Requirement: Prior experience uses the vocabulary already in the logging screen

A detail row SHALL render `prior_experience` in the same words the recent-ticks list uses, rather than
the stored enum values or a new phrasing.

#### Scenario: The three values read the same as on the logging screen

- **WHEN** detail rows render ticks with prior experience `none`, `attempted` and `sent`
- **THEN** each reads as it does in the recent-ticks list

### Requirement: Tapping a go reopens the annotation sheet

A go in the detail view SHALL be tappable, and tapping it SHALL open the annotation sheet for that
tick, seeded with what the tick already carries. Saving SHALL write through to the tick and the detail
view SHALL reflect the change without a reload.

**What the sheet reaches is the annotation fields only** — `notes`, `rating`, `grade_opinion`, `angle`,
`holds`, `length_m`. `prior_experience` and `is_send` are **not** editable, and this requirement does not
claim they are: the write path is `annotateTick`, which is deliberately confined to fields outside
`TickOutcome` because a partial of a discriminated union is unsound.

That leaves a real gap, stated here rather than glossed: a mis-tapped `prior_experience` is still
permanently wrong, and that field is flash rate's denominator, so a phantom first encounter inflates the
metric at exactly the grade it exists to find. Correcting it needs a write path that replaces the whole
`TickOutcome` rather than patching part of it, and a control in the sheet to drive it. Neither is in this
change.

#### Scenario: The sheet opens seeded with existing values

- **WHEN** a go carrying notes and a rating is tapped in the detail view
- **THEN** the sheet opens with those values already filled in

#### Scenario: An edit is persisted and shown

- **WHEN** a value is changed in the sheet opened from the detail view
- **THEN** the tick is updated in the database and the detail row shows the new value

#### Scenario: Annotation is not gated on the session being open

- **WHEN** a go in a closed session has its notes changed
- **THEN** the stored tick reflects the change, exactly as it would mid-session

### Requirement: The annotation sheet's countdown and heading follow why it opened

The annotation sheet SHALL start its idle countdown only when it opened as a consequence of a tick
being written. When it is opened deliberately — from the recent-ticks list or from the session detail
view — it SHALL NOT close itself, and its heading SHALL NOT claim the tick was just logged.

The countdown exists to keep an interruption of the two-tap logging path cheap. There is no such path
to protect when the sheet was asked for, and a form that begins draining the moment it is deliberately
opened does the opposite of what the countdown is for.

#### Scenario: Logging a tick opens a sheet that closes itself

- **WHEN** the sheet opens immediately after a tick is written and is not touched
- **THEN** it closes itself after the idle interval

#### Scenario: A deliberately opened sheet stays put

- **WHEN** the sheet is opened by tapping an existing go and is not touched
- **THEN** it remains open, and no countdown is shown

#### Scenario: The heading does not claim a fresh write

- **WHEN** the sheet is opened by tapping an existing go
- **THEN** its heading does not state that the tick was just logged

### Requirement: History is not deletable in Phase 0

The Sessions view and the session detail view SHALL provide no way to delete a session or a tick.
Removing a tick remains available only through the recent-ticks list of the open session.

Undo is deliberately session-scoped: it exists because a two-tap interface maximises mis-taps while
you are standing at the wall. Deleting from history is a different operation with different
consequences, and Phase 0 accepts that a session logged at the wrong venue stays.

#### Scenario: No delete affordance in history

- **WHEN** the Sessions view or a session detail view is inspected
- **THEN** neither offers a control that deletes a session or a tick

### Requirement: The empty state says what will appear

With no sessions stored, the Sessions view SHALL explain what will appear there and offer a route to
start a session, rather than rendering an empty list.

#### Scenario: Day one explains itself

- **WHEN** the Sessions view is opened with no sessions in the database
- **THEN** it states that logged visits will appear there and offers a way to start one
