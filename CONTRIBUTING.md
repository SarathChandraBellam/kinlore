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
   publishes a GitHub _prerelease_ tagged `staging-<short sha>`. The release
   is rejected unless it contains a Linux AppImage, a Windows installer, a
   macOS disk image, and `SHA256SUMS`.
4. Production: bump the version and [CHANGELOG.md](CHANGELOG.md) in a PR and
   merge to `main`. Then in Actions, run **release-production** with that
   `version` (X.Y.Z). A maintainer approves the `production` environment;
   [release-production.yml](.github/workflows/release-production.yml) tags
   `vX.Y.Z` and publishes a GitHub Release with the same installer assets and
   notes from the changelog. An existing production tag is not replaced.

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

## Design, languages, and first contributions

Read [the family experience spec](specs/003-family-experience/spec.md) before
changing navigation or a primary flow. Propose a journey and its empty, pending,
error, and success states; include desktop and narrow layouts, visible keyboard
focus, and long translated text. Explain the problem in an issue before a broad
redesign. Small PRs should preserve archive compatibility and offline operation.

Contributions can be code, design sketches, accessibility findings, English/Telugu/
Hindi/Tamil copy review, setup docs, or test cases. A useful first issue has a clear
reproduction, expected result, and a small scope. Maintainers can label suitable
issues `good first issue` or `help wanted`; no labels or public repository settings
are changed by this implementation.

Use invented people and text in fixtures. Do not upload a real family archive,
recording, screenshot containing private data, or API key. Tests use temporary
archives and mocked OpenRouter responses; contributors do not need a paid provider.
When testing AI drafts, verify source references and the separate apply/save step.
Only explicitly approved text requests may contact OpenRouter from main; keys,
sealed words, audio, and unrelated records must never appear in the preview.

Before release, perform live microphone, playback, keyboard, screen-reader, narrow
layout, and all-language checks. Automated rendering checks cover structure and
privacy but do not replace these checks or sessions with families.
