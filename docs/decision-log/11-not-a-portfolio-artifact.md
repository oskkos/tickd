---
id: D11
title: Not a portfolio artifact
status: accepted
related: []
---

# D11 — Not a portfolio artifact

Earlier drafts optimised for CV legibility, which justified Terraform, GraalVM native image, and
hand-rolled Postgres backups as things that "read well to reviewers".

**Decided:** the goal is to build it well and use it, not to get hired. So: no Terraform (one
service, one registry, one database), no GraalVM (jOOQ isn't native-ready), and managed Postgres
rather than owned backups.

Worth recording the general point, since it drove a lot of earlier reasoning: nobody is impressed by
*which invoice you pay*. What reads well is CI/CD, migrations on deploy, health checks, structured
logs and a documented cost model — all of which are demonstrable on a €6 VPS.
