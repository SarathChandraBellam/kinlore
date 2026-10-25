---
name: stack-electron
description: Electron conventions for this repo (main, preload, isolated renderer, typed IPC). Use when editing apps/desktop, BrowserWindow options, preload, or IPC.
metadata:
  type: stack
  technology: electron
---

# Electron conventions (stack-electron)

## Layout

- `apps/desktop/src/main.ts` — process, windows, dialogs, storage.
- `apps/desktop/src/preload.ts` — `contextBridge.exposeInMainWorld('kinlore', api)`.
- `apps/desktop/src/renderer/` — React + Vite. `window.kinlore` is typed in `global.d.ts`.
- `apps/desktop/scripts/dev.mjs` — `tsc -b`, Vite server, then Electron with
  `VITE_DEV_SERVER_URL`.

## Commands

- `npm run dev` (root) launches the GUI.
- `npm run build` compiles packages + main/preload and Vite-bundles the renderer.
  It does not open a window.
- `npm run dist` runs `build` then electron-builder (`apps/desktop/electron-builder.yml`).
  Builds are unsigned until production signing secrets are set.

## Style and typing

- IPC channel strings and `KinloreApi` live in `@kinlore/ipc-contract` only.
- `webPreferences`: `preload` set, `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`.
- Load the Vite URL in dev; `loadFile` `out/renderer/index.html` in production.

## Errors and logging

- Main IPC handlers throw; Electron serializes the message to the renderer.
- Never send file bytes or archive JSON to logs.

## Tests

- Do not boot Electron in unit tests. Cover archive I/O in `@kinlore/storage`.

## Avoid

- `nodeIntegration: true`, disabling `contextIsolation`, or exposing `ipcRenderer` wholesale.
- Importing `@kinlore/storage` from renderer code.
- Auto-update. Packaging is unsigned electron-builder; do not add signing or
  auto-update unless that work is in scope.
