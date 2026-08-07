## Why

Every quality check in this repository is currently opt-in. `just check` exists and passes, but nothing
runs it — not before a commit, not on a push, not on a pull request. Three of the last four changes
were merged on the strength of a human remembering to run it.

The specific failures this leaves open are ones already seen in this repo:

- A **stale generated module** committed without regenerating. `codegen-check` catches it; nothing
  invokes `codegen-check`.
- **Formatting drift** landing in a commit, then getting fixed in an unrelated one, so the diff stops
  describing the change.
- **Commit messages that ignore the convention** documented in `CLAUDE.md` — which is currently enforced
  by nothing but attention, and the existing history already diverges.
- A **broken `develop`** discovered only when Cloudflare Pages builds it, which is a deploy, not a test.

CI matters more than usual here because Cloudflare Pages builds `develop` on every push and serves the
result to the phone that will hold real ticks. Right now the first thing that notices a bad merge is
production.

## What Changes

- **A committed `.githooks/` directory**, activated by a `prepare` script rather than a hook-manager
  dependency.
- **A `pre-commit` hook** running `codegen-check`, `fmt-check`, `typecheck` and `lint` — measured at
  ~7.1 s total on the current tree.
- **A `commit-msg` hook** enforcing Conventional Commits with this project's documented types and
  monorepo scopes, letting merge, revert, fixup and squash messages through untouched.
- **A GitHub Actions workflow** running the full suite on pull requests and on pushes to `develop`,
  invoking the same `just` recipes used locally rather than restating them as workflow steps.
- **`fmt-check` folded into `just check`**, so one command is the whole gate and the pre-commit hook is
  a documented subset of it.

Explicitly **not** in this change:

- **No `lint-staged` and no partial checks.** At 7 s the whole tree is affordable, and staged-only
  checking has its own failure mode where the working tree and the commit disagree.
- **No new dependencies.** Hook installation is one `git config` call; commit-message validation is a
  shell script encoding the rule `CLAUDE.md` already states.
- **No CI deploy step.** Cloudflare Pages already builds and deploys `develop` (`CONCEPT.md` §9.0);
  duplicating that in Actions would create two deploy paths.
- **No branch protection rules or required-status configuration.** That is repository settings, not
  repository content, and cannot be committed.
- **No rewriting of existing history** to match the commit convention.

## Capabilities

### New Capabilities

- `quality-gates`: what must pass before a commit is created and before a branch can merge, where those
  checks are defined, and the rule commit messages follow.

### Modified Capabilities

- `build-tooling`: `just check` gains `fmt-check`, so the aggregate recipe is the single definition of
  "everything is fine" that both the hooks and CI defer to.

## Impact

- **New**: `.githooks/pre-commit`, `.githooks/commit-msg`, `.github/workflows/ci.yml`.
- **Modified**: `justfile` (`check` gains `fmt-check`; a recipe to install the hooks), root
  `package.json` (`prepare` script), `openspec/specs/build-tooling/spec.md` via the delta.
- **Developer-facing**: after this lands, `pnpm install` configures `core.hooksPath`, and commits that
  fail a check or use a malformed message are refused. `--no-verify` remains the deliberate escape
  hatch; CI is the gate that cannot be skipped.
- **Risk**: a hook that is slow or wrong trains people to pass `--no-verify` habitually, at which point
  the hooks are worse than nothing because they create false confidence. The mitigation is keeping the
  hook fast, keeping it a strict subset of CI, and treating CI rather than the hook as the real gate.
