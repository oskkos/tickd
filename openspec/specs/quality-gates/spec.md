# quality-gates

## Purpose

What must pass before a commit is created and before a branch can merge, where those checks are defined,
and the rule commit messages follow.

The distinction that shapes everything here: the pre-commit hook is a **fast subset** that can be
bypassed with `--no-verify`, and the pull-request gate is the **real** one that cannot. A hook slow
enough to annoy gets bypassed habitually, at which point it supplies false confidence rather than
protection — so the hook stays fast on purpose and CI carries the guarantee.

## Requirements

### Requirement: Hooks install without a dependency or a manual step

Git hooks SHALL live in a committed `.githooks/` directory and be activated by pointing
`core.hooksPath` at it from a `prepare` script, so a fresh clone has working hooks after
`pnpm install` and no hook-manager package is added to the tree.

#### Scenario: A fresh clone gets hooks from install alone

- **WHEN** the repository is cloned and `pnpm install` runs
- **THEN** `git config core.hooksPath` reports `.githooks`
- **AND** no separate hook-installation command was required

#### Scenario: An explicit recipe repairs hooks when install is a no-op

- **WHEN** `pnpm install` reports "Already up to date" and therefore skips lifecycle scripts
- **THEN** `git config core.hooksPath` is left untouched
- **AND** an explicit recipe SHALL exist that sets it and prints the resulting value

Reinstalling is the obvious thing to try when hooks appear inactive, and it is precisely the case where
`prepare` does not run. The repair path cannot be "install again".

#### Scenario: Hooks are readable and executable as committed

- **WHEN** the hook files are inspected
- **THEN** each is a plain shell script with its executable bit set in git

#### Scenario: No hook manager is added

- **WHEN** the dependency tree is inspected
- **THEN** it contains no hook-management package

### Requirement: A commit is refused when the tree fails the fast checks

A `pre-commit` hook SHALL run generated-code drift detection, formatting verification, typechecking and
linting, and SHALL abort the commit if any fails. It SHALL NOT run the test suite or a production
build — those belong to the pull-request gate, which cannot be skipped.

#### Scenario: A clean tree commits

- **WHEN** all four checks pass
- **THEN** the commit is created

#### Scenario: Drifted generated code blocks the commit

- **WHEN** a spec has been edited without regenerating its committed output
- **THEN** the commit is refused, naming the check that failed and the command that fixes it

#### Scenario: Unformatted code blocks the commit

- **WHEN** a file does not match the formatter's output
- **THEN** the commit is refused

#### Scenario: A type error blocks the commit

- **WHEN** any workspace package fails to typecheck
- **THEN** the commit is refused

#### Scenario: A lint error blocks the commit

- **WHEN** any workspace package fails to lint
- **THEN** the commit is refused

#### Scenario: A missing check runner fails loudly

- **WHEN** the command the hook delegates to is not on `PATH`
- **THEN** the hook refuses the commit and says so, rather than passing silently

A hook that cannot run its checks and exits zero is worse than no hook, because it looks like
protection.

#### Scenario: The hook completes fast enough not to be bypassed

- **WHEN** the pre-commit hook runs on a tree of the current size
- **THEN** it completes in roughly ten seconds or less

#### Scenario: The escape hatch stays available

- **WHEN** a commit is made with `--no-verify`
- **THEN** the hook does not run, and the pull-request gate still enforces the same checks

#### Scenario: The hook sees the working tree, not the staged snapshot

- **WHEN** only some of a file's changes are staged
- **THEN** the hook validates the working tree, so a commit can pass the hook and still fail CI

Accepted deliberately. Solving it needs staged-subset checking or stashing, which costs more than the
failure mode is worth while commits land one per task group. CI catches it.

### Requirement: Commit messages follow Conventional Commits

A `commit-msg` hook SHALL reject a message whose subject does not match
`<type>(<scope>)?!?: <description>`, where `type` is one of the types documented in `CLAUDE.md` and
`scope`, when present, is one of the documented monorepo scopes.

#### Scenario: A conforming message is accepted

- **WHEN** the subject is `feat(web): add the grade grid`
- **THEN** the commit proceeds

#### Scenario: A message without a scope is accepted

- **WHEN** the subject is `docs: record the hosting decision`
- **THEN** the commit proceeds

Root-level work — tooling, CI, the justfile — has no scope. Omitting it is correct rather than a gap to
fill with an invented one.

#### Scenario: A breaking-change marker is accepted

- **WHEN** the subject is `feat(grade-spec)!: split the ordinal namespaces`
- **THEN** the commit proceeds

#### Scenario: An unknown type is rejected

- **WHEN** the subject is `update: tweak the styles`
- **THEN** the commit is refused, and the message lists the allowed types

#### Scenario: An unknown scope is rejected

- **WHEN** the subject is `feat(frontend): add a button`
- **THEN** the commit is refused, and the message lists the allowed scopes

A type used where a scope belongs — `test(ci):` — fails here, which is the intended behaviour.

#### Scenario: A missing description is rejected

- **WHEN** the subject is `feat(web):` with nothing after the colon
- **THEN** the commit is refused

#### Scenario: Git's own messages pass through

- **WHEN** the message is a merge, revert, fixup or squash message generated by git
- **THEN** it is accepted unmodified

#### Scenario: A real merge is not blocked

- **WHEN** `git merge` creates a merge commit
- **THEN** the hook accepts the generated message and the merge commit is created

`git merge` *does* invoke `commit-msg`, and it passes an empty commit-source argument — measured, not
assumed. So the message-prefix check is what allows merges through, not the source argument. A hook that
returns non-zero here aborts the merge, which is how a convention gets deleted rather than followed.

#### Scenario: Comments and empty lines are ignored

- **WHEN** the message file contains git's commentary lines and a trailing body
- **THEN** only the first non-comment line is validated

### Requirement: Every pull request runs the full suite

A GitHub Actions workflow SHALL run the complete aggregate check on pull requests targeting the default
branch and on pushes to it. It SHALL invoke the same `just` recipes used locally rather than restating
the commands, so the two cannot drift.

#### Scenario: A pull request is checked

- **WHEN** a pull request targeting `develop` is opened or updated
- **THEN** the workflow runs the aggregate check and reports pass or fail on the pull request

#### Scenario: A push to the default branch is checked

- **WHEN** a commit lands on `develop`
- **THEN** the workflow runs, so a bad merge is reported by CI rather than first noticed in a deploy

#### Scenario: CI catches what the hook would have

- **WHEN** a commit that fails one of the pre-commit checks is pushed using `--no-verify`
- **THEN** the workflow fails on that same check

#### Scenario: CI runs the same definition as the developer

- **WHEN** the workflow file is read
- **THEN** its check step invokes `just`, and no check is expressed as a duplicated shell command

#### Scenario: The pinned toolchain is used

- **WHEN** the workflow sets up Node and pnpm
- **THEN** it takes the versions from the repository's own pins rather than hardcoding them a second
  time

#### Scenario: Dependencies are installed reproducibly

- **WHEN** the workflow installs dependencies
- **THEN** it uses the committed lockfile and fails if the lockfile is out of date

#### Scenario: Superseded runs do not queue

- **WHEN** a new commit is pushed to a branch whose workflow is still running
- **THEN** the in-progress run is cancelled

### Requirement: The default branch requires the check to pass

The default branch SHALL be protected so that merging requires the workflow's check to have passed, and
so that direct pushes are refused in favour of a pull request.

This is repository configuration rather than repository content, so it cannot be committed. It is
recorded here because without it the workflow is advisory: a green tick nobody is required to wait for
protects nothing.

#### Scenario: A pull request cannot merge until the check passes

- **WHEN** the required check has not succeeded on a pull request
- **THEN** merging is blocked

#### Scenario: The branch cannot be pushed to directly

- **WHEN** a push targets the default branch outside a pull request
- **THEN** it is refused

#### Scenario: Protection rules do not block merging

- **WHEN** the protection configuration is reviewed
- **THEN** it restricts deletion, force-pushes and non-linear history, and does **not** restrict ref
  updates

Restricting ref updates with an empty bypass list blocks every merge, including through a pull request,
because merging updates the branch. It reads as protection and is a lockout.

#### Scenario: Allowed merge methods agree with the history rule

- **WHEN** linear history is required
- **THEN** the offered merge methods exclude merge commits, so an impossible option is not presented

### Requirement: One aggregate command defines "everything is fine"

The aggregate check recipe SHALL include formatting verification alongside drift detection,
typechecking, linting, tests and the production build, so that both the hooks and CI defer to a single
definition rather than each listing checks.

#### Scenario: The aggregate includes formatting

- **WHEN** the aggregate check runs against an unformatted tree
- **THEN** it fails

#### Scenario: The hook is a subset of the aggregate

- **WHEN** the pre-commit hook's checks are compared with the aggregate's
- **THEN** every hook check is also part of the aggregate

#### Scenario: Checks are ordered cheapest first

- **WHEN** the aggregate runs
- **THEN** faster checks run before slower ones, so a trivial failure does not wait behind the slowest
