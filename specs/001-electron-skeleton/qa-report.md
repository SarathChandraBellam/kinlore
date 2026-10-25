# QA report 001

Verdict: PASS

| Gate | Command | Result |
| --- | --- | --- |
| format | `npm run format:check` | pass |
| lint | `npm run lint` | pass |
| typecheck | `npm run typecheck` | pass |
| tests | `npm test` | pass (11 passed, 0 skipped) |
| build | `npm run build` | pass (tsc + Vite renderer) |

| Criterion | Test case | Test | Result |
| --- | --- | --- | --- |
| AC1 | TC11 | in-repo npm scripts | pass |
| AC3 | TC12 | `tsc -b` | pass |
| AC4 | TC1–TC5, TC9–TC10 | `local-json-archive.test.ts` | pass |
| AC5 | TC6–TC8 | path-escape tests | pass |
| AC6 | TC13 | `apps/desktop/src/main.ts` + `preload.ts` | pass (review) |
| AC7 | TC14 | `packages/storage/src/encryption.ts` | pass (review) |
| AC8 | TC15 | OSS files + `.github/workflows/ci.yml` | pass (review) |
| AC9 | TC16 | `tsconfig.base.json` | pass (review) |
| AC2 | TC17 | workspace package.json exports | pass (review) |

Defects found: none

Not verified: Electron GUI launch (explicitly out of scope). Electron/esbuild
postinstall scripts were skipped by this environment's `allowScripts`; `npm run
build` does not need the Electron binary.
