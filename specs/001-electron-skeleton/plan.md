# Plan 001: Electron + TypeScript desktop skeleton

## Design notes

Greenfield scaffold on the agentic-dev-starter. Keep `.agents/` personas and
`specs/` conventions. Ignore Tauri/Python.

npm workspaces (`apps/*`, `packages/*`). TypeScript project references from a
strict `tsconfig.base.json`. Packages compile to `dist/`; the renderer is Vite

- React and is typechecked separately.

Archive: directory of pretty-printed JSON + media files (`kinlore.json`
manifest). `LocalJsonStorage` implements `StorageProvider`. `EncryptionProvider`
is an explicit unimplemented extension point.

Electron: main + preload compiled with `tsc`; renderer bundled with Vite.
`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Preload
exposes `window.kinlore` matching `KinloreApi`.

Rejected: pnpm (template has no lockfile; brief allows npm), SQLite (extra
native dep), electron-vite/electron-builder (not needed to build without GUI).

## Tasks

- [ ] T1: Root tooling — workspaces, tsconfig base + solution, ESLint flat,
      Prettier, Vitest, editorconfig, nvmrc, gitignore (files: root configs;
      serves: AC1, AC9)
- [ ] T2: `packages/core` domain types (files: `packages/core/**`; serves: AC3)
- [ ] T3: `packages/ipc-contract` typed channels + `KinloreApi` (files:
      `packages/ipc-contract/**`; serves: AC6)
- [ ] T4: `packages/storage` layout, provider, local JSON impl, encryption
      TODO, unit tests in a temp dir (files: `packages/storage/**`; serves:
      AC4, AC5, AC7)
- [ ] T5: `apps/desktop` main/preload/renderer, Vite, secure defaults, IPC
      wiring (files: `apps/desktop/**`; serves: AC2, AC6)
- [ ] T6: OSS docs, GitHub templates, CI, AGENTS.md, CLAUDE.md, stack/repo
      skills (files: README, LICENSE, .github, AGENTS.md, `.agents/skills`;
      serves: AC8)
- [ ] T7: `npm install` and all check scripts; qa-report (serves: AC1)

## Test strategy

| Criterion | Level            | Notes                                       |
| --------- | ---------------- | ------------------------------------------- |
| AC1       | integration      | Run the five npm scripts in-repo            |
| AC2       | review           | Workspace layout and package exports        |
| AC3       | unit / typecheck | Types exported; `tsc -b`                    |
| AC4       | unit             | Vitest temp-dir create/open/round-trip      |
| AC5       | unit             | Path-escape cases                           |
| AC6       | review           | main/preload source; no GUI launch required |
| AC7       | review           | Encryption interface + TODO only            |
| AC8       | review           | Files present                               |
| AC9       | typecheck        | Base compiler options                       |

## Risks and rollback

- Electron's postinstall downloads a binary; CI/build needs network once.
- ESM preload + sandbox is supported on current Electron; if a GUI launch
  ever fails, drop `sandbox` only — not `contextIsolation`.
- Rollback: revert the branch; no migrations.
