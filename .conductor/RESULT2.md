# Release pipeline result

Added: `.github/workflows/ci.yml` (job `ci`), `release-staging.yml`, `release-production.yml`, `.github/CODEOWNERS`, `apps/desktop/electron-builder.yml`, root `npm run dist`.

| Check | Result |
| --- | --- |
| lint / format:check / typecheck / test (11) / build | pass |
| actionlint v1.7.12 (3 workflows) | pass |
| `npm run dist -- --linux --dir` | pass (unsigned unpacked Linux) |

Open: create GitHub envs `staging`+`production`; require status check `ci` and code-owner reviews; signing secrets still commented; keep `electronVersion` in sync with `electron`; mac/win installers not built here; `@electron/rebuild` engines warn on Node 20 (unused, `npmRebuild: false`).
