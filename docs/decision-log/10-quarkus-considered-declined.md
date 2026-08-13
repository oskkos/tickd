---
id: D10
title: Quarkus considered, declined
status: accepted
related: [D9]
---

# D10 — Quarkus considered, declined

**Considered:** Quarkus instead of Spring Boot, prompted by image size against Artifact Registry's
0.5 GB free tier.

**Decided:** stay on Spring Boot. Not because Quarkus is worse — it's a good framework — but because
nothing here is a problem it solves.

- **Image size isn't a real constraint.** Layer deduplication plus layered jars keeps you inside the
  free tier, and the unmitigated cost is cents (§9.5). If image size ever mattered, the fix is
  layered jars → distroless base → jlink-trimmed JRE, not a framework change.
- **Startup is already solved.** The JDK 25 AOT cache gets Spring Boot to 0.27 s, which neutralises
  Quarkus's main JVM-mode advantage.
- **Quarkus's biggest advantage — clean native image — is blocked by jOOQ, not by Spring.** The
  reference build failure is literally `quarkus-jooq#177`, and jOOQ isn't on GraalVM's
  ready-for-native-image list regardless of framework, because `DefaultRecordMapper` relies on
  reflection. Switching frameworks does not open the native path.
- Lower memory footprint is a genuine Cloud Run advantage (GiB-seconds), but usage is ~5% of the
  free allowance, so nothing is squeezed.

Quarkus would be the right call if you dropped jOOQ for Hibernate/Panache and wanted native. But
jOOQ *is* the reason the backend was chosen (D9) — the analytics are window functions and
`percentile_cont`. That trade runs the wrong way.
