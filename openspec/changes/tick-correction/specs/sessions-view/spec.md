## MODIFIED Requirements

### Requirement: Tapping a go reopens the annotation sheet

A go in the detail view SHALL be tappable, and tapping it SHALL open the go sheet for that tick, seeded with
what the tick already carries. Saving SHALL write through to the tick and the detail view SHALL reflect the
change without a reload.

**The sheet reaches the annotation fields and the corrections alike.** `notes`, `rating`, `grade_opinion`,
`angle`, `holds` and `length_m` are edited directly; the tick's grade, its protection and its outcome are
correctable one tap deeper, through controls that replace whole unions rather than patching them.

This retracts the carve-out this requirement used to state. `prior_experience` and `is_send` were not
editable, and that was named here as a real gap because `prior_experience` is flash rate's denominator, so a
phantom first encounter inflates the metric at exactly the grade it exists to find. The gap is closed: the
write path replaces the whole `TickOutcome` instead of patching part of it, and the sheet carries a control
to drive it.

**One limitation replaces it, and is stated rather than implied away.** Correction does not cross a
discipline — a go logged as a boulder when it was a roped route, or the reverse, stays wrong. The scale
travels with the discipline, so such a correction would leave the grade in a notation it was never graded
with, and converting between Font and French is deliberately deferred (D17). From the detail view of a
closed session there is no other repair path, which is the residual cost of this change rather than an
oversight in it.

#### Scenario: The sheet opens seeded with existing values

- **WHEN** a go carrying notes and a rating is tapped in the detail view
- **THEN** the sheet opens with those values already filled in

#### Scenario: An edit is persisted and shown

- **WHEN** a value is changed in the sheet opened from the detail view
- **THEN** the tick is updated in the database and the detail row shows the new value

#### Scenario: Annotation is not gated on the session being open

- **WHEN** a go in a closed session has its notes changed
- **THEN** the stored tick reflects the change, exactly as it would mid-session

#### Scenario: A grade is corrected from a closed session

- **WHEN** a go in a closed session has its grade corrected
- **THEN** the stored tick carries the new grade and the detail row shows it without a reload

#### Scenario: An outcome is corrected from a closed session

- **WHEN** a go recorded with the wrong prior experience is corrected in the detail view
- **THEN** the stored tick carries the new outcome and the row's outcome mark and wording follow it

#### Scenario: A wrong discipline is not correctable here

- **WHEN** the sheet is opened for a go logged under the wrong discipline
- **THEN** it offers no control that changes the discipline, and the row keeps its protection wording

### Requirement: History is not deletable in Phase 0

The Sessions view and the session detail view SHALL provide no way to delete a session or a tick. Removing a
tick remains available only through the recent-ticks list of the open session.

Undo is deliberately session-scoped: it exists because a two-tap interface maximises mis-taps while you are
standing at the wall. Deleting from history is a different operation with different consequences, and Phase 0
accepts that a session logged at the wrong venue stays.

**Correction is not deletion, and its arrival does not soften this.** A go's grade, protection and outcome
are correctable in place from the detail view; the go itself, and the session around it, are not removable.
The two are different operations: correction preserves the sequence of the evening, which is what the detail
view exists to show, while a removal from the middle of it does not.

#### Scenario: No delete affordance in history

- **WHEN** the Sessions view or a session detail view is inspected
- **THEN** neither offers a control that deletes a session or a tick

#### Scenario: Correction does not remove the go

- **WHEN** a go in the detail view is corrected
- **THEN** the same number of goes is listed afterwards, in the same order
