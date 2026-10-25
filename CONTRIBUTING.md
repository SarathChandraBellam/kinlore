# Contributing to Kinlore

Thank you for helping families keep stories in their own voices.

## Ground rules

- Follow the [Code of Conduct](CODE_OF_CONDUCT.md).
- Keep work local-first: do not add network calls, accounts, or telemetry that
  send family data off the machine without an explicit user action.
- Stay in scope. Note follow-ups instead of drive-by refactors.
- Do not commit secrets, `.env` files, or a real `KinloreArchive` folder.

## Develop

Node.js 20+ (`.nvmrc`). From the repo root:

```bash
npm install
npm run dev
```

## Before you open a pull request

Run the same gates CI runs:

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

Fix format locally with `npm run format`.

Non-trivial changes use the lifecycle in [AGENTS.md](AGENTS.md): a folder under
`specs/<id>-<slug>/` with `spec.md`, `plan.md`, `test-cases.md`, and later
`qa-report.md`.

## Package boundaries

Import `@kinlore/core`, `@kinlore/storage`, and `@kinlore/ipc-contract` from
their public entry only. The renderer must not import `@kinlore/storage` or
Node `fs`. Talk to the main process through `window.kinlore`.

## Security reports

Please do not file public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).
