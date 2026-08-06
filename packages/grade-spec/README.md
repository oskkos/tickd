# @tickd/grade-spec

The authoritative definition of every grade scale the app understands, plus the ordinal API over it.

```
scales.yaml            the spec — explicit ordered label lists, versioned
scripts/generate.ts    emits src/generated/scales.ts (data only, no logic)
src/generated/         committed, so typechecking needs no codegen step
src/index.ts           the hand-written API
src/types.assert.ts    type-level assertions; `tsc --noEmit` is the test
```

```sh
just codegen        # regenerate after editing scales.yaml
just codegen-check  # fail if the committed module has drifted
```

## The two invariants this package exists to protect

**Font and French are separate ordinal namespaces.** Font `6A` and French `6a` differ only by letter
case and mean very different difficulties. Mapping them to one ordinal puts boulders and routes on a
single pyramid and silently corrupts every metric (`CONCEPT.md` §7.3, D5).

Separation is structural, not asserted. An `Ordinal<S>` carries its scale as a literal-typed field, so
`Ordinal<'french'>` and `Ordinal<'font'>` are incompatible under structural typing, and `compare` takes
`NoInfer` on its second parameter — without it TypeScript infers `S` as the union of both scales and
accepts `compare(french6a, font6A)`. `src/types.assert.ts` fails to typecheck if either guard is
removed.

**Case is data, never presentation.** `isLabel` compares exactly: nothing is trimmed, lowercased or
uppercased. A normalising validator would reclassify `6A` as a rope grade instead of rejecting it. The
same rule forbids `text-transform` on a grade anywhere in the UI (`DESIGN.md` §2).

## Deliberately absent

- **Cross-scale conversion.** V-scale, YDS, UIAA, Scandinavian and Finnish are deferred (D1, D5), and
  Phase 0's single analytic groups within a discipline, so nothing crosses scales.
- **A Kotlin emitter.** Phase 0 has no Kotlin build, so it would emit a file nothing compiles. The YAML
  is the contract; adding an emitter later is additive (`CONCEPT.md` §8.4).
- **Open and unknown grades.** Indoor gyms always tag a single grade, so `Ordinal` is a union of one
  variant — `{ kind: 'exact' }`. Adding `{ kind: 'range' }` later is one line here and a compile error
  in every consumer that assumed a single variant.

## Editing the scales

Every label must be **quoted**. Unquoted, `4` and `5` parse as YAML integers while `4+` and `6a` parse
as strings, and a coerced label is indistinguishable from a correct one downstream — the generator
rejects non-strings rather than coercing. Each scale also declares a `count`, so a dropped line fails
the build instead of quietly shortening a scale.
