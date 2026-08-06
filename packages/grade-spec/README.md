# @tickd/grade-spec

**Empty on purpose — content lands in its own change.**

This package will hold the versioned grade specification: one YAML file that generates both the
TypeScript and Kotlin implementations, so the two cannot diverge (`CONCEPT.md` §7.3, §8.4).

Two invariants it exists to protect, both easy to violate:

- **Font and French are separate ordinal namespaces.** Font `6A` (boulder) and French `6a` (rope)
  differ only by letter case and mean very different difficulties. One shared UI grid, never one
  shared ordinal scale.
- **`grade_raw` + `grade_scale` are stored; ordinals are derived at read time** through a versioned
  conversion table. Never bake a canonical ordinal at write time.

The package is scaffolded ahead of its content so the generated-module import path is settled before
anything depends on it (`CONCEPT.md` §13).
