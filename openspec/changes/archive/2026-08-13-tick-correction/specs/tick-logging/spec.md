## ADDED Requirements

### Requirement: A written tick's grade, protection and outcome are correctable

A tick's grade, its protection, and its outcome SHALL be correctable after the tick is written, from every
surface that shows a tick. A correction SHALL persist immediately, with no confirm step, exactly as the
original tap did. A correction SHALL leave every other field of the tick untouched — its annotations, its
session, and its place in time.

These three are the fields that were unreachable, and they were unreachable for a reason rather than by
oversight: each is a paired union, and the annotation write path patches individual fields, which a partial
of a discriminated union cannot safely do. Correcting them needs a write that replaces a union whole.

**Undo is not a substitute, even mid-session.** Removing a go from the middle of an evening and logging it
again appends it at the end, so the sequence — the thing the session detail exists to show — is lost, and
the re-logged row is stamped with the moment of the correction rather than the moment of the climb. That is
why this is an edit and not a delete.

#### Scenario: A mis-tapped grade is re-picked

- **WHEN** a go was logged at the wrong grade and its grade is corrected
- **THEN** the stored tick carries the new grade, in the notation it was already recorded in

#### Scenario: A stale protection is corrected on a go already logged

- **WHEN** a go was logged as `lead` because the sticky protection was not switched, and its protection is
  corrected to `toprope`
- **THEN** the stored tick carries `toprope` and its discipline is unchanged

#### Scenario: A correction is reachable from the recent-ticks list

- **WHEN** a go logged earlier in the open session needs its grade fixed
- **THEN** it can be corrected from the list of recent ticks, without ending the session

#### Scenario: Annotations survive a correction

- **WHEN** a go carrying notes, a rating and an angle has its grade corrected
- **THEN** the notes, rating and angle are still present on the stored tick

### Requirement: The outcome is corrected as a whole, never one half

Correcting the outcome SHALL set `is_send` and `prior_experience` together, offering the same six valid
combinations the logging screen offers. No control SHALL correct one of the two without the other.

Two reasons, and either alone is sufficient. The storage layer requires the outcome to be written whole,
because patching part of a union is the operation that lets its halves disagree. And a control reaching
only `prior_experience` would leave a go recorded as not sent when it was sent permanently wrong — the same
category of mistake as a mis-tapped grade, and the reason `is_send` is in scope at all.

#### Scenario: Every outcome is reachable when correcting

- **WHEN** the outcome control is opened for a written tick
- **THEN** all six combinations of `prior_experience` and `is_send` can be chosen

#### Scenario: A go recorded as not sent can be corrected to sent

- **WHEN** a go stored with `is_send = false` is corrected to a first-go send
- **THEN** the stored tick carries `is_send = true` and `prior_experience = 'none'`, and reads as a flash

### Requirement: Correction never crosses a discipline

A roped tick's protection SHALL be correctable among `lead`, `toprope` and `autobelay` only. A boulder
tick SHALL be offered no protection control at all. Grade correction SHALL offer only the labels of the
scale the tick already carries. No control SHALL change a tick's `discipline` or its `grade_scale`.

The scale travels with the discipline. Correcting a boulder to a roped go at Kiipeilyareena Salmisaari or
Ristikko — Font boulder, French rope — would leave a Font label under a French scale, and converting
between the two notations is deliberately deferred (D17). Boulder's `protection: 'none'` is not a choice
either; it is what boulder means, so there is nothing to offer, exactly as on the logging screen.

**This leaves a stated gap.** A go logged under the wrong discipline stays wrong. It bites hardest at
Tampereen Kiipeilykeskus Nekala, which grades both disciplines in French: the grid renders identical labels
either way, so nothing on screen contradicts a wrong discipline. Mid-session the escape is undo and re-log;
once the session closes there is none. The hole is narrowed rather than open — the logging screen re-seeds
its discipline from the session's newest tick, so navigating away and back no longer resets it — and
closing it properly means a grade re-pick on the new scale, which this change does not build.

#### Scenario: A roped go's protection moves within the roped set

- **WHEN** the protection control is opened for a roped tick
- **THEN** it offers `lead`, `toprope` and `autobelay`, and nothing else

#### Scenario: A boulder go offers no protection control

- **WHEN** the go sheet is opened for a tick whose protection is `none`
- **THEN** no protection control is present

#### Scenario: The grade control offers only the tick's own notation

- **WHEN** the grade control is opened for a tick recorded in Font
- **THEN** it renders Font labels, and no control switches it to French

#### Scenario: No control changes the discipline

- **WHEN** the go sheet is inspected for any tick
- **THEN** it offers no way to turn a boulder into a roped go or the reverse

### Requirement: The go sheet states what was recorded, and each part corrects in place

The sheet that opens for a tick SHALL show that tick's grade, its protection and its outcome as its own
first line, with each part a target of its own. Tapping a part SHALL present the control for that field in
place of the detail panel, and committing a value SHALL return to the sheet showing the corrected tick.
Corrections SHALL sit one tap deeper than the annotation controls, so the two-tap logging path gains no tap.

The sheet is already the "this go, in detail" surface and already opens from both surfaces that show a
tick, so one implementation serves both. Its reopened heading already asks *"anything to change?"* — this
is what makes that true. Putting the corrections behind one tap each is what keeps the fast path intact:
a climber who has nothing to correct never sees a control they did not ask for.

The sheet SHALL show the corrected value without being closed and reopened. The sheet renders from the row
it was opened with, so a correction that writes to the database and leaves that copy behind would show the
old grade above a grid that had just changed it — a stale read presented as the current state.

#### Scenario: The sheet states what was recorded

- **WHEN** the sheet is open for a tick
- **THEN** its grade, its protection and its outcome are all shown

#### Scenario: Tapping a part opens its control

- **WHEN** the grade on the sheet's first line is tapped
- **THEN** the grade control appears in place of the detail panel

#### Scenario: The corrected value is shown immediately

- **WHEN** a new grade is chosen in the sheet's grade control
- **THEN** the sheet shows the new grade without being closed and reopened

#### Scenario: The inactivity close does not interrupt a correction

- **WHEN** the sheet opened as a consequence of a write and a correction control is then opened
- **THEN** the sheet does not close itself while the correction is being made

#### Scenario: Logging still takes two taps

- **WHEN** a tick is logged with the sheet's corrections available
- **THEN** logging still takes exactly two taps, and no correction control is passed through

### Requirement: A correction applies to one go and no others

A correction SHALL apply to exactly the tick it was opened for. No control SHALL apply a correction to more
than one go at a time.

A stale sticky protection typically spans several goes, so per-tick correction is deliberately tedious in
exactly the case that motivated this change. It is still the right scope: a bulk control has to invent a
rule about which goes it covers, and the same stale default may have been correct for some of them —
guessing wrong would turn one wrong field into several. The cause is better attacked by making a
non-default protection more visible while logging, which is a separate change.

#### Scenario: Correcting one go leaves its neighbours alone

- **WHEN** one of several goes logged under the same wrong protection is corrected
- **THEN** only that go changes, and the others still carry the original value

#### Scenario: No bulk control is offered

- **WHEN** a correction control is open
- **THEN** it offers no way to apply the value to the rest of the session

### Requirement: A correction leaves the go where it is in the session

A corrected tick SHALL keep its position in every ordering of the session's goes, and SHALL keep the time
shown against it. Correction SHALL NOT be implemented as a removal followed by a fresh write.

The recent-ticks list is newest-first and the session detail is oldest-first; both order by when the go was
logged. A correction that re-stamped the go would move it to the end of the evening in one list and the top
of the other, so fixing a grade would silently rewrite the sequence of the session.

#### Scenario: The corrected go keeps its place in the recent list

- **WHEN** the third of five goes in a session has its grade corrected
- **THEN** it is still the third go in the session's ordering

#### Scenario: The time shown against the go does not change

- **WHEN** a go logged at 18:42 is corrected an hour later
- **THEN** the go still shows 18:42

## MODIFIED Requirements

### Requirement: The grade grid shows the whole scale, positioned at the working range

The grid SHALL render every label of the active scale, easiest first, and SHALL set its initial scroll
position so the climber's working range is visible without scrolling.

The working range is `[min − 2 … max + 2]` over the last 90 days, computed **per
`(discipline, grade_scale)`** and over all ticks rather than sends only. A single range across scales
would mix French rope with Font boulder, which is the error §4.2 warns about; a sends-only range would
omit the grade you are currently failing on, which is the grade you will be back on.

Positioning SHALL be a starting position rather than an animated scroll, and SHALL be recomputed on mount
and when the discipline changes, but **not** after each tick.

**When the grid is correcting a written tick rather than logging a new one, it SHALL open at that tick's
own grade.** The working range answers "what am I likely to climb next", which is the wrong question for a
correction: the answer is already known, and a mis-tap is almost always adjacent to the cell that was
meant. Opening anywhere else would make the common correction a scroll. A correction SHALL NOT recompute or
move the logging grid's position, for the same reason logging does not — the grid must not move under a
thumb that is about to tap it.

**The grid SHALL be the scrolling region, which requires a bounded height.** Set inside a shell that
grows with its content, the grid renders at its full natural height, `scrollHeight` equals
`clientHeight`, and setting a scroll position is a silent no-op while the page scrolls instead — leaving
the working range below the fold with every guard still passing. The grid SHALL therefore keep a minimum
height of its own: it competes for vertical space with the recent-ticks list, and without a floor it was
measured squeezed to a single row of grades mid-session, while a floor with nothing able to yield pushed
rows off-screen entirely. Whatever gives, no row may become unreachable.

**Where content continues past an edge, the grid SHALL show it.** Mobile overlay scrollbars appear only
*while* scrolling, so they are feedback and never discovery: three visible rows of nine read as the whole
scale. Both edges need it, because the grid opens partway down — with only a bottom cue the hardest
grades announce themselves while the easier ones look absent. The initial position SHALL clear the top
cue rather than sit under it, or the one row the positioning exists to reveal is the row obscured.

#### Scenario: Every grade remains reachable

- **WHEN** the grid is shown
- **THEN** every label of the active scale is present, including ones far outside the working range

#### Scenario: The working range needs no scrolling

- **WHEN** the screen opens for a climber with ticks in the last 90 days
- **THEN** their working range is visible immediately

#### Scenario: Ranges do not mix scales

- **WHEN** a climber has French rope ticks and Font boulder ticks
- **THEN** each discipline's grid is positioned from its own range

#### Scenario: Day one does not misbehave

- **WHEN** the screen opens with no ticks at all
- **THEN** the grid renders from the easiest grade and nothing is positioned or hidden

#### Scenario: Logging does not move the grid

- **WHEN** a tick is logged at a grade outside the current range
- **THEN** the grid does not reposition during the session

#### Scenario: A correcting grid opens at the tick's own grade

- **WHEN** the grade control is opened for a tick recorded at `7a`
- **THEN** the grid opens with `7a` visible without scrolling, rather than at the working range

#### Scenario: A correction does not move the logging grid

- **WHEN** a go is corrected to a grade outside the current working range
- **THEN** the logging screen's grid keeps the position it had

#### Scenario: The grid can actually scroll

- **WHEN** the active scale is taller than the space the grid has
- **THEN** the grid scrolls within its own bounds rather than the page growing

#### Scenario: Grades beyond an edge are announced

- **WHEN** grades continue above or below the visible rows
- **THEN** that edge is marked, and the marking goes away at the end of the content

#### Scenario: The working range is not obscured by its own cue

- **WHEN** the grid opens positioned at a working range with easier grades above it
- **THEN** the first row of the range is clear of the top edge marking

#### Scenario: A session's worth of ticks does not crowd out the grid

- **WHEN** many goes have been logged in the session
- **THEN** the grid keeps enough height to remain the primary target, and no logged go becomes unreachable
