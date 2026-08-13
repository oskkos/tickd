---
id: D5
title: Grades: what's in, what's out
status: accepted
related: [D1]
---

# D5 — Grades: what's in, what's out

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
