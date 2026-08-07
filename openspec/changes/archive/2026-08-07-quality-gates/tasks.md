## 1. One aggregate definition

- [x] 1.1 Add `fmt-check` to the `just check` recipe, before the slower checks so formatting fails fast
- [x] 1.2 Confirm `just check` fails on an unformatted file and passes once formatted

## 2. Hook installation

- [x] 2.1 Add `"prepare": "git config core.hooksPath .githooks"` to the root `package.json`
- [x] 2.2 Add a `just install-hooks` recipe as the explicit path for anyone who installed with
      `--ignore-scripts`
- [x] 2.3 Create `.githooks/` and confirm `git config core.hooksPath` reports it after `pnpm install`
- [x] 2.4 Set the executable bit on both hooks in git, and verify it survives a fresh clone
      (verified at the end of group 4, once both hooks exist)

## 3. The pre-commit hook

- [x] 3.1 Write `.githooks/pre-commit` calling `just codegen-check fmt-check typecheck lint` — recipes,
      not the underlying commands
- [x] 3.2 Abort on the first failure with a message naming the failing check and the command that fixes
      it
- [x] 3.3 Fail loudly if `just` is not on PATH, rather than passing silently
- [x] 3.4 Verify each of the four checks blocks a commit: drifted generated module, unformatted file,
      type error, lint error
- [x] 3.5 Verify a clean tree commits, and time the hook to confirm it stays near the measured ~7 s
- [x] 3.6 Verify `--no-verify` still bypasses it

## 4. The commit-msg hook

- [x] 4.1 Write `.githooks/commit-msg` validating `<type>(<scope>)?!?: <description>` against the types
      and scopes documented in `CLAUDE.md`
- [x] 4.2 Read only the first non-comment, non-empty line, so a body and git's commentary are ignored
- [x] 4.3 Let merge, revert, fixup and squash messages through, using both the message prefix and git's
      commit-source argument
- [x] 4.4 On rejection, print the offending subject, the expected form, and both allowed lists
- [x] 4.5 Verify accepted: with a scope, without a scope, with `!`, and with a multi-line body
- [x] 4.6 Verify rejected: unknown type, unknown scope, missing description, empty subject
- [x] 4.7 Verify a real `git merge` with a generated message is not blocked

## 5. GitHub Actions

- [x] 5.1 Add `.github/workflows/ci.yml` triggered on `pull_request` targeting `develop` and on `push`
      to `develop`
- [x] 5.2 Set up pnpm via corepack from `packageManager`, and Node from `.nvmrc` — no hardcoded versions
- [x] 5.3 Install `just` in the runner so the check step is `just check`
- [x] 5.4 Install with the committed lockfile and fail if it is out of date
- [x] 5.5 Cache the pnpm store keyed on the lockfile
- [x] 5.6 Add a concurrency group cancelling superseded runs for the same ref
- [x] 5.7 Confirm no check in the workflow is expressed as a duplicated shell command

## 6. Verify end to end

- [x] 6.1 Push the branch and confirm the workflow runs on the pull request and reports status
- [x] 6.2 Push a deliberately failing commit with `--no-verify` and confirm CI catches what the hook
      would have
- [x] 6.3 Confirm the run is cancelled when superseded by a newer push
- [x] 6.4 Confirm CI passes on a clean branch, then revert the deliberate failure
- [x] 6.5 Time the CI run and record it, so a future slowdown is visible — 45s
- [x] 6.6 Update `CLAUDE.md` to say hooks are active, what they check, and that `--no-verify` exists but
      CI does not
