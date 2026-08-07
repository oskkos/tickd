## Context

`just check` already runs drift detection, typecheck, lint, tests and the build, and passes. Nothing
invokes it. The gap is not missing checks — it is missing enforcement.

Measured on the current tree, warm:

| Recipe | Time |
| --- | --- |
| `codegen-check` | 0.6 s |
| `fmt-check` | 1.0 s |
| `typecheck` | 1.9 s |
| `lint` | 3.6 s |
| `test` | 2.1 s |
| `check` (all of the above plus build) | 10.4 s |

That measurement is what makes this design boring: at ~7 s for the four pre-commit checks there is no
need for staged-file filtering, incremental caching or a background daemon. Those would all be reasonable
at 45 s and are unjustifiable at 7 s.

One constraint from `CLAUDE.md`: commits land one per top-level task group, so a six-group change pays
the hook six times. ~45 s per change, spread across the work rather than in one wait.

## Goals / Non-Goals

**Goals:**

- Hooks that work in a fresh clone with no step beyond `pnpm install`.
- A pre-commit gate fast enough that bypassing it never becomes a habit.
- Commit messages mechanically held to the convention `CLAUDE.md` documents.
- CI that runs the same definition of "fine" that a developer runs.
- One place a check is declared.

**Non-Goals:**

- `lint-staged` or any staged-subset checking.
- A hook-manager dependency.
- Deploying from CI — Cloudflare Pages owns that (`CONCEPT.md` §9.0).
- Branch protection or required-status settings; those live in repository configuration, not the tree.
- Rewriting the existing non-conforming history.
- Caching or parallelising the checks. At these timings it would be optimisation without a problem.

## Decisions

**`core.hooksPath` set from a `prepare` script, no dependency.** husky's actual mechanism is one `git
config` call in a lifecycle script; the package is convenience around that. `"prepare": "git config
core.hooksPath .githooks"` gets the same behaviour, keeps the hooks as readable shell in the repo, and
adds nothing to the tree. pnpm runs `prepare` on install, including Cloudflare's
`--frozen-lockfile`, where setting a git config is harmless.

Considered and rejected: **husky** (a dependency for one line), **lefthook** (a binary to install, and
its parallelism buys nothing at 7 s), **`simple-git-hooks`** (smallest of the three, still a dependency
for a `git config` call).

**A shell `commit-msg` hook, not commitlint.** This is the closest call in the change, and one tempting
argument for it does not hold: commitlint would *not* save maintaining the scope list.
`@commitlint/config-conventional` does not restrict scopes by default, so enforcing
`web | grade-spec | backend | docs | openspec` means configuring `scope-enum` — the list lives in
`commitlint.config.js` instead of in a hook script. Either way it exists in `CLAUDE.md` plus one other
file.

What commitlint genuinely provides is edge-case handling: it ignores merge, revert and fixup/squash
messages by default, and it validates header length, footer wrapping and breaking-change footers. It
also runs over a commit range in CI, which would answer the open question about squash-merged pull
request titles for free.

Declined anyway, on the grounds that two dependencies and a config file to validate a one-line pattern
sits badly in a repository that self-hosts its fonts and chose `just` over Nx. **The cost is
concentrated in one place:** the merge/revert/fixup passthrough is hand-rolled, and getting it wrong
breaks `git merge` and `git rebase --autosquash` — which is how a convention gets deleted rather than
followed. Bounded by testing it explicitly rather than trusting it.

**`lint-staged` declined for a more specific reason than speed.** Two of the four pre-commit checks
cannot be narrowed to staged files at all: `tsc` must see the whole project, and `codegen-check`
compares a spec against a generated file. lint-staged would narrow only `fmt-check` and `lint` — about
4.6 s of the 7.1 s — while the other two run in full regardless.

The benefit being given up is correctness rather than speed: lint-staged stashes unstaged changes so the
checks see exactly the committed snapshot. That is a real improvement over what is specified here, and
it is declined because the stash-and-restore step has its own failure mode. Revisit if partial staging
ever becomes normal practice here; the specs are written as behaviour, so adopting it later changes no
requirement.

**Git's own messages pass through unvalidated.** Merge, revert, fixup and squash messages are generated
by git and do not follow the convention. A hook that rejects them breaks `git merge` and
`git rebase --autosquash`, which is how the rule gets deleted rather than followed. Detection is by
message prefix plus `$2`, the commit source argument git passes to `commit-msg`.

**The hook runs `just`, not the underlying commands.** Same for CI. This is the whole reason the justfile
exists, and it means adding a check is a one-line edit in one file rather than three.

**CI installs `just` rather than duplicating the recipes as workflow steps.** A workflow that lists
`pnpm -r typecheck` and friends drifts from the justfile silently — the two look consistent while
diverging. Installing a small binary is cheaper than that risk.

**Node and pnpm versions come from the repository's own pins.** `.nvmrc` for Node,
`packageManager` via corepack for pnpm. Hardcoding either in the workflow creates a second source of
truth that fails in the direction of "works in CI, breaks locally".

**A single CI job, not a matrix.** One OS, one Node version, checks run in sequence. There is no
cross-platform surface to test — the deploy target is Cloudflare Pages and the client is a browser — and
`just check` is 10 s, so splitting it into parallel jobs would spend more time on runner startup than it
saves.

**`fmt-check` folded into `just check`.** It was omitted originally, which meant "everything CI would
run" did not include formatting. The hook then becomes a strict subset of the aggregate rather than an
overlapping list.

## Risks / Trade-offs

- **A slow or flaky hook trains habitual `--no-verify`** → keep it to the measured four checks, keep it a
  subset of CI, and treat CI as the gate that matters. If the hook ever exceeds ~10 s, drop a check from
  it rather than accepting the latency.
- **Pre-commit hooks validate the working tree, not the staged snapshot** → a partial `git add` can
  produce a commit that fails CI while the hook passed. Documented rather than solved: the fix is
  `lint-staged` or stashing, both of which cost more than the failure mode is worth in a solo repository
  that commits whole task groups. CI catches it.
- **The allowed types and scopes now live in two places** (`CLAUDE.md` and the hook) → the hook prints
  both lists on failure, so a divergence surfaces immediately rather than silently.
- **`prepare` does not run for consumers who install with `--ignore-scripts`** → the hooks are then
  inert with no warning. A `just install-hooks` recipe exists as the explicit path, and CI does not
  depend on hooks at all.
- **CI cannot enforce anything without branch protection** → a green check that nobody is required to
  wait for is advisory. Enabling "require status checks to pass" is a repository setting and therefore
  outside this change; it is worth doing by hand afterwards, and the change is not finished in spirit
  until it is.

## Migration Plan

Additive. After merge, the next `pnpm install` on any clone configures `core.hooksPath`; before that the
hooks are simply inert. Existing commits are not revalidated — the `commit-msg` hook only sees new ones.

Rollback is `git config --unset core.hooksPath` locally, and reverting the commit for everyone.

Ordering that matters: `fmt-check` must join `just check` before CI is written, so CI does not need
changing immediately afterwards.

## Open Questions

- **Should CI also validate the pull-request title** against the convention? A squash merge takes its
  subject from the PR title, so the `commit-msg` hook never sees it, and a non-conforming title becomes a
  non-conforming commit on `develop`. Both merges so far were rebases, where the hook's per-commit
  validation is what lands — so this only matters if squash merging is ever used.
- **Should the workflow run on `pull_request` alone, or also on `push` to `develop`?** Both is specified
  here on the grounds that Cloudflare deploys `develop` and the current situation is that a bad merge is
  first noticed by a deploy. The cost is a duplicate run on merge.
