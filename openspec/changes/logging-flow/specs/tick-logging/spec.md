## ADDED Requirements

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

#### Scenario: Annotation is reachable from the recent list

- **WHEN** a tick logged earlier in the session needs a note
- **THEN** it can be reached from the list of recent ticks

### Requirement: Optional detail is presented where it can be seen

The detail controls SHALL be presented over the screen rather than in flow beneath it, SHALL NOT trap
interaction, and MAY close themselves after a period of inactivity.

Rendered in flow after the grade grid they fall below the fold on a phone — present in the DOM and
invisible in the hand, which is the same as absent. A modal would be worse: it would block the next
grade tap and turn every log into three interactions on a screen whose premise is two.

**Closing on inactivity does not contradict undo being persistent.** That rule exists because a
four-second undo window is useless when the mistake is noticed after the next climb. Detail is
different: the tick is already written, every change is saved as it is made, and the same controls
reopen from the recent list — so nothing is lost when they close.

#### Scenario: Detail is visible without scrolling

- **WHEN** a tick is logged
- **THEN** the detail controls appear over the screen rather than below the content

#### Scenario: Logging continues with the detail controls open

- **WHEN** another grade is chosen while they are open
- **THEN** they close and logging proceeds, because they never blocked it

#### Scenario: They do not close under someone using them

- **WHEN** the climber interacts with the detail controls
- **THEN** the inactivity period restarts

#### Scenario: Nothing is lost when they close

- **WHEN** the detail controls close by inactivity after a value was set
- **THEN** the value is stored, and reopening the tick from the recent list shows it

#### Scenario: The remaining time is visible

- **WHEN** the detail controls are open
- **THEN** the time left before they close is shown, and it restarts with the inactivity period

A sheet that vanishes without warning reads as a glitch. Showing the countdown makes the close
predictable and lets the climber decide whether to hurry or ignore it — and the indicator SHALL derive
its duration from the same value as the timeout, so the two cannot drift apart.

### Requirement: The grade grid shows the whole scale, positioned at the working range

The grid SHALL render every label of the active scale, easiest first, and SHALL set its initial scroll
position so the climber's working range is visible without scrolling.

The working range is `[min − 2 … max + 2]` over the last 90 days, computed **per
`(discipline, grade_scale)`** and over all ticks rather than sends only. A single range across scales
would mix French rope with Font boulder, which is the error §4.2 warns about; a sends-only range would
omit the grade you are currently failing on, which is the grade you will be back on.

Positioning SHALL be a starting position rather than an animated scroll, and SHALL be recomputed on mount
and when the discipline changes, but **not** after each tick.

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

The screen SHALL show recent ticks from the current session, each reversible, and each SHALL display what
was actually recorded rather than the grade alone.

§3 makes undo first-class because a two-tap interface maximises mis-taps. `DESIGN.md` requires it to be
persistent rather than a transient toast — a toast that vanishes in four seconds is useless when the
mistake is noticed after the next climb. Defaults do much of the logging, so this list is the only place
a wrong default becomes visible while still at the wall.

#### Scenario: A mis-tap is reversible after the next climb

- **WHEN** a tick was logged several ticks ago
- **THEN** it is still visible and can still be removed

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
