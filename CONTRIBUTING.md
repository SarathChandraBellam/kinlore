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

Fix format locally with `npm run format`. Package unsigned installers with
`npm run dist` (electron-builder: Windows NSIS, macOS DMG, Linux AppImage for
the current OS).

Non-trivial changes use the lifecycle in [AGENTS.md](AGENTS.md): a folder under
`specs/<id>-<slug>/` with `spec.md`, `plan.md`, `test-cases.md`, and later
`qa-report.md`.

## Review and release

Every pull request needs maintainer approval. [CODEOWNERS](.github/CODEOWNERS)
requires a review from `@SarathChandraBellam`.

1. Branch from `main` and open a pull request targeting `main`.
2. The GitHub Actions job named `ci` must pass (`format:check`, lint,
   typecheck, test, build on Ubuntu).
3. After maintainer approval and merge, [release-staging.yml](.github/workflows/release-staging.yml)
   packages the Electron app (unsigned) on Ubuntu, Windows, and macOS and
   publishes a GitHub _prerelease_ tagged `staging-<short sha>`.
4. Production: push a git tag `vX.Y.Z` matching `package.json` (or run
   **release-production** with that tag via `workflow_dispatch`).
   [release-production.yml](.github/workflows/release-production.yml) creates a
   full GitHub Release with the installers and notes taken from
   [CHANGELOG.md](CHANGELOG.md).

GitHub Environments `staging` and `production` must exist on the repository
(create them under Settings → Environments). Code signing secrets (`CSC_LINK`,
`CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`,
`WIN_CSC_LINK`) are placeholders only; builds stay unsigned until those are
configured.

## Package boundaries

Import `@kinlore/core`, `@kinlore/storage`, and `@kinlore/ipc-contract` from
their public entry only. The renderer must not import `@kinlore/storage` or
Node `fs`. Talk to the main process through `window.kinlore`.

## Security reports

Please do not file public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).
