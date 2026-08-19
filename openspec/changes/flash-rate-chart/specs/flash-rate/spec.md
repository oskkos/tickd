## ADDED Requirements

### Requirement: Flash rate is flashes over first encounters

The surface SHALL compute, for each grade, a numerator of ticks where `is_send` is true and
`prior_experience` is `'none'`, and a denominator of ticks where `prior_experience` is `'none'` regardless of
`is_send`. It SHALL use the `isFlash` and `isFirstEncounter` predicates already defined beside the tick model
rather than re-deriving either, so that no second copy of the definition can drift from the first.

The denominator SHALL NOT filter on `is_send`. Dividing by sends is biased upward at exactly the limit grade
the metric exists to locate: ten different 7a's — one flashed, one redpointed, eight abandoned — gives 1 ÷ 2
rather than 1 ÷ 10 (D14). This is the one metric that deliberately does not filter for sends.

#### Scenario: An unsent first encounter counts in the denominator

- **WHEN** a grade has one flash and nine first encounters that were never sent
- **THEN** its rate is reported as 1 of 10, not 1 of 1

#### Scenario: A repeat counts in neither

- **WHEN** a tick carries `prior_experience` of `'attempted'` or `'sent'`
- **THEN** it contributes to neither the numerator nor the denominator, whether or not it was a send

#### Scenario: A flash is a send with no prior experience

- **WHEN** a tick carries `is_send = true` and `prior_experience = 'none'`
- **THEN** it counts in both the numerator and the denominator

### Requirement: Every rate is keyed by discipline, scale and protection together

The surface SHALL group ticks by `(discipline, grade_scale, protection)` and SHALL NOT report any rate
computed across more than one value of any of the three.

Neither half of `(discipline, grade_scale)` can do the other's job (§4.2, D17): grouping by discipline alone
pools Font and French boulders into one ranking of incomparable values, and grouping by scale alone pools
boulders with routes. Protection joins the key rather than being applied as a later filter, because pooling a
toprope flash with a lead flash at the same grade raises the curve precisely where the crossing is read.

`protection = 'none'` means boulder (§7.4), so the pairing guaranteed by the tick model makes boulder produce
its own groups with no special case.

The set of groups SHALL be derived from the ticks present, never from a fixed list. Under the seeded venues,
boulder alone spans two scales — Font at the Kiipeilyareena sites, French at Tampere — so a fixed set of panes
would either drop a scale or pool two notations whose labels differ only in letter case.

#### Scenario: Two boulder scales are two charts

- **WHEN** the logbook holds boulder first encounters graded in Font and others graded in French
- **THEN** two separate charts are shown, each labelled with its scale, and no rate combines the two

#### Scenario: One scale across two disciplines does not merge them

- **WHEN** rope and boulder first encounters are both graded in French
- **THEN** they are reported as separate groups

#### Scenario: Protections are not pooled

- **WHEN** a grade has lead and toprope first encounters
- **THEN** each protection's rate is computed from its own ticks alone

### Requirement: The rate is drawn as a bar against a fixed track with a ~50% reference rule

Each grade SHALL render as a row carrying the grade label verbatim, a fixed-width track whose fill length is
proportional to the rate, and the raw counts as `flashes/encounters`. Counts SHALL always be shown, in
tabular figures.

Each chart SHALL draw a vertical reference rule at the 50% position of the track, and SHALL label it. Because
the track's width does not vary between rows, one x-position means 50% for the whole chart, and the reader
finds the crossing by scanning for the row whose fill stops reaching the rule — which is what §4.2's claim
that *the grade where your flash rate crosses ~50% is your real level* asks the reader to do.

The rule and the suppressed state SHALL be conveyed by position, shape or text and never by colour alone
(`DESIGN.md` §3). The grade label SHALL NOT be case-transformed: Font `6A` and French `6a` differ only in
letter case (§7.3).

#### Scenario: A rate is legible against the rule

- **WHEN** a grade's rate is above 50%
- **THEN** its fill extends past the reference rule, and when below, it stops short of it

#### Scenario: The counts accompany every rate

- **WHEN** any grade row is shown
- **THEN** its flash count and first-encounter count are both shown beside the bar

#### Scenario: Grade text is verbatim

- **WHEN** a Font grade and a French grade are rendered
- **THEN** each label appears exactly as stored, with no case transformation applied

### Requirement: The crossing is read by the climber, never computed

The surface SHALL NOT display a computed level, limit grade, headline grade, or any single value derived from
where the curve crosses the reference rule.

§4.2 states that the counts are shown so that *you read the crossing yourself rather than being handed a
headline grade*, and the sample sizes this surface works with are the reason: a headline would state a
conclusion with more confidence than the data supports. This is specified as absent because it is the
well-meant addition a later reader would otherwise make.

#### Scenario: No headline grade is shown

- **WHEN** the surface is opened with a full range of data
- **THEN** no element names a single grade as the climber's level

### Requirement: A rate from fewer than three first encounters is shown without a fill

A grade whose denominator is fewer than three SHALL render its label and its counts, and SHALL NOT render a
proportional fill. It SHALL be visibly marked as having too few encounters to draw, by means other than colour
alone.

With one first encounter the only attainable rates are 0% and 100%; with two they are 0%, 50% and 100%. Below
three, the rate cannot take a value that sits meaningfully near the reference rule, so its position relative
to that rule carries no information while a full-length bar asserts one. The failure this prevents is
concrete: a single soft 7b in a month renders as the longest bar on the screen at the hardest grade, and
length is read before the counts beside it.

This is a presentation rule, not a filter. The row is present, the counts are unchanged, and the denominator
defined above is untouched — nothing is excluded, so *segment, never exclude* (D6) holds.

#### Scenario: One first encounter draws no bar

- **WHEN** a grade has one first encounter which was flashed
- **THEN** the row shows `1/1`, carries no proportional fill, and is marked as having too few encounters

#### Scenario: Three first encounters draw a bar

- **WHEN** a grade has three first encounters and one flash
- **THEN** the row draws a fill proportional to the rate

#### Scenario: The suppressed row is still present

- **WHEN** a grade's fill is suppressed
- **THEN** its grade label and its counts are still shown, and it is not omitted from the chart

### Requirement: A protection selector carries only the protections that have first encounters

The surface SHALL present a selector over the protections for which at least one first encounter exists, and
SHALL show one pane at a time. A protection with no first encounters SHALL be absent from the selector rather
than shown disabled or empty, and where only one protection qualifies the selector SHALL NOT render at all.

The membership test is *has a first encounter*, not *has ticks*: a protection climbed entirely as attempts and
repeats has no rate to show, so a pane for it would be empty.

A disabled entry implies the surface exists and is being withheld — the argument `app-shell` makes for the tab
bar, which does not depend on being a tab bar. A control that never varies is noise, which is the call already
made about a session card's group heading.

Boulder SHALL appear in the selector, labelled as boulder and never as `none`. `protection = 'none'` *means*
boulder (§7.4), so the selector is over the four ways a go is protected, one of which is not being protected.

The selector's order SHALL be fixed — lead, toprope, auto-belay, boulder — rather than following the order the
data was logged in. This is a reference surface returned to repeatedly, and one that reorders itself between
visits is disorienting; a session card's first-appearance order is right for a record of a visit and wrong
here.

The selected protection SHALL be held in component state and SHALL NOT be carried in the address or stored as
a preference.

#### Scenario: A protection with no first encounters is absent

- **WHEN** the logbook holds no toprope first encounters
- **THEN** no toprope entry appears in the selector, disabled or otherwise

#### Scenario: A single protection needs no selector

- **WHEN** only one protection has first encounters
- **THEN** no selector is rendered and that protection's charts are shown

#### Scenario: Boulder is named as boulder

- **WHEN** boulder first encounters exist
- **THEN** the selector entry reads as boulder, not as `none`

#### Scenario: Auto-belay gets its own pane

- **WHEN** auto-belay first encounters exist
- **THEN** they are reported in their own pane rather than merged into another protection or omitted

### Requirement: The default pane is lead when lead has data, otherwise the first that does

On opening, the surface SHALL select lead when lead has at least one first encounter, and otherwise the first
protection in the fixed order that does.

§4.2 names lead as the default view. Applied unconditionally it shows an empty pane to a climber who only
boulders, while their data sits one tap away — so the default is conditional on lead having something to show.

#### Scenario: Lead is preferred when present

- **WHEN** the surface is opened and lead has first encounters
- **THEN** the lead pane is shown

#### Scenario: A boulder-only logbook opens on boulder

- **WHEN** the surface is opened and only boulder has first encounters
- **THEN** the boulder pane is shown and no empty pane is presented

### Requirement: Every chart names the scale it is keyed on

Each chart SHALL display the scale its grades are written in, including when only one chart is shown.

This diverges deliberately from the session list, which drops a group heading that never varies. There, the
grades sit inside a visit that supplies the context; here the grade column is the axis and nothing else
identifies the notation, so an unlabelled chart leaves the reader unable to tell Font `6A` from French `6a`.
The divergence is stated so it is not later reconciled by removing the label.

#### Scenario: A single chart is still labelled

- **WHEN** the selected protection has first encounters in exactly one scale
- **THEN** that chart still displays its scale

### Requirement: The grade axis is a contiguous span with runs of unmet grades elided

Each chart's rows SHALL span contiguously from the easiest to the hardest grade holding a first encounter,
easiest at the top, in the order the scale defines.

A run of consecutive grades within that span holding no first encounter SHALL render as a single row naming
the range it covers, rather than as one row per grade.

Listing only the observed grades would place 6a beside 6c and make the curve read steeper than it is. One row
per unmet grade leaves the height unbounded — a single curious go on 8a adds a row for every grade between —
which is the same outlier sensitivity the grade grid's working range documents, handled here by bounding the
render. The span's ends are observed by construction, so a leading or trailing gap cannot occur.

#### Scenario: A gap is visible but does not read as adjacency

- **WHEN** a chart holds first encounters at 6a and at 6c but none at 6b
- **THEN** 6a and 6c are separated by a row naming the unmet grade between them

#### Scenario: A long run of unmet grades occupies one row

- **WHEN** a chart's span contains five consecutive grades with no first encounter
- **THEN** they render as a single row naming that range of grades

#### Scenario: The span is bounded by observed grades

- **WHEN** a chart is rendered
- **THEN** its first and last rows are grades holding first encounters, with no gap row at either end

### Requirement: A grade with no first encounters is never shown as a rate

A grade whose denominator is zero SHALL NOT be rendered as a percentage or as an empty proportional fill. It
SHALL appear only as part of an elided gap row.

A grade with a denominator above zero and a numerator of zero SHALL render as a real measurement, with an
empty fill and its counts. `0/0` is not a rate and `0/6` is; the two must not look alike.

#### Scenario: An unmet grade is not a zero rate

- **WHEN** a grade within the span has no first encounters
- **THEN** it is not shown as 0% and appears only within a gap row

#### Scenario: A met grade with no flashes is a real zero

- **WHEN** a grade has six first encounters and no flashes
- **THEN** it renders as a row with an empty fill and its counts, distinguishable from an unmet grade

### Requirement: The window is the whole logbook and is not selectable

The surface SHALL compute over every tick in the logbook and SHALL NOT offer a time-window control.

Phase 0 holds no data older than the install, so a window selector would be a control over data that cannot
exist. The pyramid's rolling twelve months belongs to a later phase, which needs a window for its own reasons.

#### Scenario: No window control is offered

- **WHEN** the surface is opened
- **THEN** no control filters the data by date, and every tick in the logbook is counted

### Requirement: An unreadable grade is skipped rather than failing the surface

A tick whose `grade_raw` is not a label of its `grade_scale` under the current grade spec SHALL be excluded
from both counts and from the span, and SHALL NOT cause the surface to fail to render.

Phase 0 has no migrations, so a label the current spec no longer recognises is permanent on disk. The grade
grid's working range carries the incident this rule comes from: one such row inside a mapping operation
rejected the whole query and left a discipline with no range for ninety days. Excluding the row from the span
as well as the counts prevents it from silently reappearing as an unmet grade.

#### Scenario: One bad row does not break the chart

- **WHEN** the logbook contains a tick whose grade label is not in its scale
- **THEN** the remaining ticks are aggregated and rendered, and that tick appears in no count

### Requirement: The empty state explains what will appear

When no first encounters exist, the surface SHALL show prose explaining what will appear and roughly when, and
SHALL NOT render an axis, a chart with no rows, a reference rule, or a selector.

`DESIGN.md` asks for exactly this and names this surface as the case: the flash-rate view needs weeks of ticks
before it says anything, so an empty axis presents itself as a broken chart rather than as a young logbook.

#### Scenario: A fresh logbook shows prose

- **WHEN** the surface is opened with no ticks
- **THEN** it explains what will appear and roughly when, and renders no axis or empty chart

#### Scenario: Ticks without first encounters are still empty

- **WHEN** the logbook holds ticks but none with `prior_experience = 'none'`
- **THEN** the empty state is shown rather than a chart of zero rates

### Requirement: The surface shows one analytic and reads only

The surface SHALL show flash rate by grade and no other analytic. It SHALL NOT show a grade pyramid, volume
metrics, vertical metres, a trend or plateau indication, a median grade, or a send rate by `angle` or `holds`.

It SHALL NOT write to the database. A go is corrected from the session detail, which remains the only repair
path (D23).

Phase 0 ships exactly one analytic, and holding to that is the phase's stated main risk. Vertical metres
additionally cannot be computed: wall heights are seeded absent (§12 Q1). `angle` and `holds` are descriptive
rather than analytic, because annotations are recorded while describing a climb and any metric keyed on them
skews toward sends (D19, D21).

#### Scenario: No second analytic appears

- **WHEN** the surface is opened
- **THEN** it shows flash rate by grade and no pyramid, volume, vertical-metre, trend or style-weakness figure

#### Scenario: The surface offers no correction

- **WHEN** a grade row is interacted with
- **THEN** no tick is modified and no correction control is presented

### Requirement: The chart is rendered without a charting dependency

The surface SHALL be rendered from ordinary DOM elements and SHALL NOT introduce a charting library (D25).

`CONCEPT.md` §8's stack table named uPlot or Recharts before the grade grid was settled as plain buttons; the
same argument applies with more force to at most twenty-seven categorical rows. Install weight is paid up
front because the service worker precaches the bundle before first use, and a canvas-rendered chart would make
this the one Phase 0 surface the test suite cannot query and a screen reader cannot read.

#### Scenario: Every row is readable as text

- **WHEN** the surface is rendered
- **THEN** each grade label, each count and each state is present in the accessibility tree as text

#### Scenario: No charting dependency is added

- **WHEN** the web app's dependencies are inspected
- **THEN** they contain no charting or plotting library
