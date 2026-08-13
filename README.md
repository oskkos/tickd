# tickd

An indoor climbing logbook — rope and boulder. Mobile-first, offline-capable PWA.

## Documentation

Everything in prose lives in [`docs/`](docs/):

| | |
|---|---|
| [`docs/CONCEPT.md`](docs/CONCEPT.md) | *What* the app does and why — phasing, data model, stack, hosting, risks. |
| [`docs/DESIGN.md`](docs/DESIGN.md) | *How it looks* — logo, typography, colour, the logging screen, the UI stack. |
| [`docs/decision-log/`](docs/decision-log/) | One file per decision that was argued through and changed. Cited as `D1`–`D23`. |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | The Cloudflare Pages setup, recorded because the account is out-of-repo state. |
| [`docs/ICONS.md`](docs/ICONS.md) | The icon and brand asset catalogue. |

Behaviour is specified per capability under [`openspec/specs/`](openspec/specs/), with in-flight work in
`openspec/changes/`. `CLAUDE.md` holds the working agreements for the repo.

## Building it

`just` is the single entrypoint. `just check` runs the full gate — codegen drift, formatting,
typechecking, lint, tests and a production build.
