# tick-logging

## Purpose

The logging screen: the two taps that produce a tick, the session that gives it a venue, and the go sheet
that hangs off it afterwards. `CONCEPT.md` §3 names this the wedge — *"tap grade → tap style → logged"* —
so the tap count is a requirement here rather than a target, in every case and not only when the defaults
are right.

**The sheet carries optional detail and correction alike**, which is why it is the go sheet rather than
the annotation sheet: the annotation fields are patched individually, while the grade, the protection and
the outcome are replaced as whole paired unions one tap deeper. Correcting is per go and never crosses a
discipline (D23).

**The screen is where the model's shape becomes reachable or not.** The outcome control is
`prior_experience` × `is_send` as six valid cells, which is the whole state space now that style is
derived (D20); `prior_experience` cannot be defaulted, because it is correct on the first go and wrong on
every go after, and being wrong manufactures first encounters that inflate flash rate's denominator
(§4.2, D14). A tick is one go, so four goes on a climb are four rows.

**Physical constraints are requirements, not taste** (`DESIGN.md`): 48–56px targets for chalky fingers,
primary actions in the lower thumb-reachable third for one-handed use, every tap persisting immediately
because sessions are logged in fragments, and undo persistent and visible rather than a transient toast.

Several requirements below carry the reasoning of a decision that was reversed or a defect that was
measured, because in each case the obvious-looking alternative is what was tried first: a non-blocking
detail panel that let a near-miss tap log a spurious tick, a scroll container with no bounded height
whose scroll position was a silent no-op, and a capped undo list that stranded earlier goes.

## Requirements

### Requirement: Logging a tick takes two taps

Logging SHALL require exactly two taps in every case — a grade, then an outcome — not only when defaults
are accepted. The second tap SHALL commit.

`CONCEPT.md` §3 is explicit that this is the wedge: *"tap grade → tap style → logged"*. A flow that is two
taps on defaults and three when they are wrong is not the same promise, because the deviating case is the
one that happens at your limit grade.

#### Scenario: A flash takes two taps

- **WHEN** a grade is tapped and then the first-go/sent cell
- **THEN** a tick is written and no further interaction is required

#### Scenario: A deviating outcome also takes two taps

- **WHEN** a grade is tapped and then the tried-it/didn't-send cell
- **THEN** a tick is written, with the same tap count as the default case

### Requirement: The outcome control is the complete state space

The outcome control SHALL present `prior_experience` × `is_send` as six cells, all of which are valid,
and SHALL offer no control for send style.

The two combinations §7.4 called invalid are unrepresentable rather than blocked: there is no flash button
to disable, because style is derived (D20). A disabled control would imply the state exists and is
forbidden; no control implies it was never a state.

#### Scenario: Six outcomes are offered

- **WHEN** the outcome control is shown
- **THEN** it offers first-go, tried-it and sent-it against didn't-send and sent

#### Scenario: No style control exists

- **WHEN** the logging screen is inspected
- **THEN** it offers no choice of flash, redpoint, onsight or second go

#### Scenario: A flash is labelled, not chosen

- **WHEN** the first-go/sent cell is used
- **THEN** the resulting tick reads as a flash without the climber having selected one

### Requirement: Prior experience is chosen, never defaulted

The outcome control SHALL NOT preselect a `prior_experience`, and SHALL NOT carry the previous tick's
value forward.

Because a tick is one go (D20), `none` is correct on the first go and wrong on every go after it. A
default that is wrong most of the time is worse than no default, because it is wrong silently — and wrong
here manufactures first encounters, inflating flash rate's denominator. `DESIGN.md` makes the same
argument against a sticky `send_style`.

#### Scenario: Nothing is preselected

- **WHEN** the outcome control opens
- **THEN** no cell is selected and no tick can be written without choosing one

#### Scenario: The previous choice does not persist

- **WHEN** a tick is logged with tried-it and another grade is then tapped
- **THEN** the new outcome control is again unselected

### Requirement: A tick is written on the outcome tap, with no confirmation step

The tick SHALL be persisted when the outcome cell is tapped. There SHALL be no confirm or submit step
between choosing an outcome and the tick existing.

`DESIGN.md` §4 requires that every tap persists immediately, because sessions are logged in fragments. A
confirmation step creates an interval in which a chosen grade and outcome exist nowhere — and that
interval is exactly when someone hands you a rope. Mis-taps are handled by undo, which §3 makes
first-class for this reason; a confirm step would solve the same problem twice and charge every log for it.

#### Scenario: The tick survives an interruption

- **WHEN** the outcome is tapped and the app is closed immediately
- **THEN** the tick is present when the app is reopened

#### Scenario: No submit control is offered

- **WHEN** the outcome control is shown
- **THEN** it presents no confirm, submit or "tick it" button

### Requirement: A chosen grade can be abandoned without writing

Having chosen a grade, the climber SHALL be able to return to the grid without a tick being written.

The screen commits on the outcome tap and has no confirm step, so without an explicit way back the
only escape from a mis-tapped grade is to log a tick you did not want and then undo it — two
operations and a spurious row to correct a slip, on a screen whose stated premise is that mis-taps are
common (§3).

#### Scenario: Backing out writes nothing

- **WHEN** a grade is chosen and then abandoned
- **THEN** the grid is shown again and no tick exists

### Requirement: Optional detail annotates an existing tick

`notes`, `angle`, `holds`, `rating`, `grade_opinion` and `length_m` SHALL be editable after the tick is
written, and SHALL NOT be required at any point.

§3 puts everything beyond grade and style behind progressive disclosure and calls it *"never a required
step"*. Annotating a written tick is an `UPDATE` (§7.1), which is also the operation the storage layer
considers safe for fields outside the outcome fields.

#### Scenario: Annotation follows the write

- **WHEN** a tick has been logged
- **THEN** its optional fields can be filled without logging it again

#### Scenario: Nothing is required

- **WHEN** a tick is logged and no optional field is filled
- **THEN** it is complete and valid

#### Scenario: Every optional field is fillable

- **WHEN** the detail controls are shown
- **THEN** each of `notes`, `angle`, `holds`, `rating`, `grade_opinion` and `length_m` can be set

A field kept in the schema with no way to write it is a field that will always be empty. Whichever
optional fields survive, the UI offers all of them or the model should not carry them.

#### Scenario: Clearing a value stores absence, not a placeholder

- **WHEN** a set value is cleared
- **THEN** the field becomes absent rather than zero or an empty string

#### Scenario: Annotation is reachable from the recent list

- **WHEN** a tick logged earlier in the session needs a note
- **THEN** it can be reached from the list of recent ticks

### Requirement: Optional detail is presented where it can be seen

The detail controls SHALL be presented over the screen rather than in flow beneath it, SHALL block
interaction with the content behind them, and SHALL close themselves after a period of inactivity while
untouched.

Rendered in flow after the grade grid they fall below the fold on a phone — present in the DOM and
invisible in the hand, which is the same as absent.

**Blocking reverses this requirement's own earlier position**, which was that a modal would be worse
because it turns every log into three interactions on a screen whose premise is two. Use showed the
trade running the other way: a tap meant for the controls that landed just outside them logged a *whole
new tick* and replaced the panel being filled in, so not blocking cost a wrong row in the database and
the climber's place in the form. Blocking costs a tap. The inactivity close is what keeps that price
honest — untouched, the controls let go by themselves, so the two-tap path is interrupted only once the
climber actually reaches for the detail.

The dismissal target SHALL be at least the blocked area, so the way out is never smaller than the way
in, and the blocking SHALL be visible rather than silent — interaction that stops working with no
indication reads as the app having frozen.

**Closing on inactivity does not contradict undo being persistent.** That rule exists because a
four-second undo window is useless when the mistake is noticed after the next climb. Detail is
different: the tick is already written, every change is saved as it is made, and the same controls
reopen from the recent list — so nothing is lost when they close.

#### Scenario: Detail is visible without scrolling

- **WHEN** a tick is logged
- **THEN** the detail controls appear over the screen rather than below the content

#### Scenario: A near-miss tap cannot log a tick

- **WHEN** a tap lands on the content behind the open detail controls
- **THEN** no tick is written, and the controls close instead

#### Scenario: They do not close under someone using them

- **WHEN** the climber interacts with the detail controls
- **THEN** the inactivity close is retired for that tick rather than restarted

A countdown that keeps restarting still chases someone mid-form: they would be racing a clock to finish
a field that was optional to begin with. The first interaction answers the only question the timer
asked.

#### Scenario: Nothing is lost when they close

- **WHEN** the detail controls close by inactivity after a value was set
- **THEN** the value is stored, and reopening the tick from the recent list shows it

#### Scenario: The remaining time is visible

- **WHEN** the detail controls are open and untouched
- **THEN** the time left before they close is shown

#### Scenario: The indicator goes away rather than freezing

- **WHEN** the climber interacts with the detail controls
- **THEN** the countdown indicator is removed

A sheet that vanishes without warning reads as a glitch. Showing the countdown makes the close
predictable and lets the climber decide whether to hurry or ignore it — and the indicator SHALL derive
its duration from the same value as the timeout, so the two cannot drift apart. Once the close is
retired the indicator is removed rather than stopped, because a frozen bar promises a timer that is
merely paused.

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
### Requirement: Discipline selects the scale the venue grades in

The screen SHALL offer a discipline mode that selects which of the venue's scales the grid renders, and
SHALL offer only disciplines the venue provides.

A scale is a notation, not a discipline (D17): the same venue may grade boulders in Font and routes in
French, and another may grade both in French. A venue that carries no scale for a discipline does not
offer it, so the control for it is absent rather than disabled.

#### Scenario: Switching discipline switches notation

- **WHEN** the discipline changes at a venue grading boulders in Font and routes in French
- **THEN** the grid re-renders with the other scale's labels

#### Scenario: A boulder-only venue offers no rope mode

- **WHEN** the venue carries no rope scale
- **THEN** no rope option is presented

#### Scenario: Protection follows discipline

- **WHEN** boulder is selected
- **THEN** `protection` is `none` and no protection control is shown

### Requirement: Protection is sticky and visible

`protection` SHALL default to its previous value and SHALL remain visible on the logging screen rather
than behind disclosure.

`DESIGN.md` permits a sticky default here specifically because a wrong `protection` is visible on screen,
unlike a wrong style. Visibility is the condition that makes stickiness safe, so it is a requirement
rather than a layout preference.

#### Scenario: The previous value carries forward

- **WHEN** a tick is logged on lead and another grade is tapped
- **THEN** lead is still selected

#### Scenario: The current value is always readable

- **WHEN** the logging screen is shown for a roped discipline
- **THEN** the active protection is visible without opening anything

### Requirement: Recent ticks are visible and reversible

The screen SHALL show the go just logged, SHALL keep every earlier go of the session reachable without
leaving the screen, and each row SHALL display what was actually recorded rather than the grade alone.

§3 makes undo first-class because a two-tap interface maximises mis-taps. `DESIGN.md` requires it to be
persistent rather than a transient toast — a toast that vanishes in four seconds is useless when the
mistake is noticed after the next climb. Defaults do much of the logging, so this list is the only place
a wrong default becomes visible while still at the wall.

**Only the latest go is shown by default, and the rest are behind a control.** The shell is bounded to
the viewport so the grade grid can position at the working range, which makes this list a competing
claimant on the same vertical space: left long, it becomes a second scrolling region directly beneath
the grid, and one swipe then does different things depending on where the thumb lands — erratic on the
screen most likely to be used one-handed with chalk on.

**A cap alone would be a regression, not a simplification.** There is no other route to an earlier go,
so hiding it without a way back would make it permanently unrevertible and contradict undo being
first-class. Whatever collapses the list SHALL therefore also expand it.

#### Scenario: A mis-tap is reversible after the next climb

- **WHEN** a tick was logged several ticks ago
- **THEN** it can still be reached and removed without leaving the screen

#### Scenario: Collapsing never strands a go

- **WHEN** more goes exist than are shown
- **THEN** their number is reported and revealing them removes nothing from reach

#### Scenario: Rows show what was recorded

- **WHEN** a recent tick is displayed
- **THEN** it shows grade, protection, prior experience and whether it was sent

#### Scenario: Undo is not a transient notification

- **WHEN** a tick is logged
- **THEN** the means of reversing it does not disappear on a timer

### Requirement: A session is started explicitly at a venue

Logging SHALL require an open session, and a session SHALL be started explicitly by choosing a venue.
Location SHALL be a hint that orders the list, never a gate.

§3 requires the venue to be pre-filled from the last session and the UI to be fully usable without
location, because indoors GPS may never resolve.

#### Scenario: The last venue is offered first

- **WHEN** the session-start screen opens
- **THEN** the most recently used venue is preselected

#### Scenario: Location is never required

- **WHEN** location is unavailable or denied
- **THEN** a session can still be started and every venue remains choosable

#### Scenario: Logging requires a session

- **WHEN** no session is open
- **THEN** the logging screen leads to starting one rather than writing a tick

### Requirement: A session ends explicitly, and is closed lazily when it was not

A session SHALL be endable explicitly, producing `ended_at` at the moment it ends. A session left open
SHALL be closed on a later launch, with `ended_at` set to its last tick's timestamp.

The lazy trigger SHALL be idle time since the last tick, **not** a change of local date. Closing on a date
change fires when logging past midnight — a case §7.7 explicitly contemplates — and would end a session
while the climber is still on the wall.

Setting `ended_at` to the moment of the later launch is forbidden: it would reproduce the multi-day
session the fallback exists to prevent.

#### Scenario: An explicit end records when it ended

- **WHEN** a session is ended from the app
- **THEN** `ended_at` is the moment of ending, capturing time after the last tick

#### Scenario: A forgotten session is closed at its last tick

- **WHEN** the app is opened and a session has been idle beyond the threshold
- **THEN** it is closed with `ended_at` set to its last tick's timestamp

#### Scenario: Logging past midnight does not close the session

- **WHEN** the app is reopened shortly after midnight during an active session
- **THEN** the session remains open

#### Scenario: A lazy close is announced

- **WHEN** a session is closed by the fallback
- **THEN** the climber is told, rather than finding an unexplained session in their history

### Requirement: Ending a session is confirmed and offers a summary

Ending SHALL require a confirmation, and SHALL present what the session contained.

Ending is destructive of the current context and reachable by mis-tap like anything else. The
confirmation is not ceremony because it carries the session summary — the one moment where reviewing the
session makes sense, when the climber has stopped rather than being mid-log.

#### Scenario: Ending is not a single tap

- **WHEN** end is tapped
- **THEN** the session is not yet closed and a summary is shown

#### Scenario: The summary reflects the session

- **WHEN** the summary is shown
- **THEN** it reports the venue, duration and what was logged

### Requirement: A session with no ticks leaves no trace

A session that closes with no ticks SHALL be deleted rather than recorded, whether it closes explicitly or
lazily.

#### Scenario: An abandoned session is discarded

- **WHEN** a session is started and closed without any tick
- **THEN** no session remains

#### Scenario: A session with ticks is kept

- **WHEN** a session with at least one tick closes
- **THEN** it is retained with its `ended_at` set
