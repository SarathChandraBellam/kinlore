---
name: repo-domain-knowledge
description: This project's domain and system knowledge - glossary of business terms, core entities and rules, architecture map, integrations, data flows and known gotchas. Use when a task mentions business terms, touches core entities or integrations, or when exploring the codebase for the first time.
metadata:
  type: repo
  kind: knowledge
---

# Domain and system knowledge

What a new teammate needs to know beyond the code. Agents add facts as they discover them (with a source), and a human confirms.
Keep each section short. Move large material to `references/` and link to it.

## Glossary

| Term       | Meaning in this project                     | Not to be confused with              |
| ---------- | ------------------------------------------- | ------------------------------------ |
| Archive    | A folder of JSON + media (`KinloreArchive`) | A backup zip, a git repo             |
| Person     | Someone in the family graph                 | An app user account (there are none) |
| Recording  | An audio/video file plus metadata           | A generated voice clip               |
| Story      | A narrative that points at real recordings  | LLM-invented text                    |
| Keepsake   | An object or note tied to people            | A social-media post                  |
| Consent    | Per-person, per-scope grant                 | A one-time TOS checkbox              |
| KinloreApi | Typed preload bridge (`window.kinlore`)     | Raw `ipcRenderer` in the UI          |

## Core entities and business rules

- `Person`, `Recording`, `Story`, `Keepsake`, `Consent` live in `@kinlore/core`.
- Stories cite `recordingIds`. Answers must play a real clip, never invented audio.
- Consent `scope` is `recording` \| `archive` \| `export` \| `generated-voice`.
- Entity ids match `[A-Za-z0-9_-]+`. Media paths cannot leave the archive root.
- Encryption is not on. `EncryptionProvider` is the future hook.

## Architecture map

| Component    | Path                          | Responsibility               | Talks to                   |
| ------------ | ----------------------------- | ---------------------------- | -------------------------- |
| Renderer     | `apps/desktop/src/renderer`   | UI                           | `window.kinlore` only      |
| Preload      | `apps/desktop/src/preload.ts` | `contextBridge`              | ipc-contract + ipcRenderer |
| Main         | `apps/desktop/src/main.ts`    | Windows, dialogs, archive    | `@kinlore/storage`         |
| Core         | `packages/core`               | Domain types                 | nothing                    |
| Storage      | `packages/storage`            | Archive I/O                  | `@kinlore/core`, `node:fs` |
| IPC contract | `packages/ipc-contract`       | Channel names + `KinloreApi` | `@kinlore/core`            |

## Integrations

| System              | Purpose           | How we call it                | Env vars (names only) | Test double         |
| ------------------- | ----------------- | ----------------------------- | --------------------- | ------------------- |
| Filesystem          | Archive folder    | `node:fs/promises` in storage | none                  | temp dirs in Vitest |
| OS keychain / DPAPI | Future encryption | not implemented               | none                  | n/a                 |

## Data flows

- User picks a folder (or uses `<userData>/KinloreArchive`) → main `create`/`open` → JSON + media on disk.
- Renderer mutates people through IPC; main writes `people/<id>.json`.

## Gotchas

- `npm run typecheck` is `tsc -b` then renderer `tsc --noEmit`. Run it after packages can emit `.d.ts`.
- Relative imports in compiled packages use `.js` extensions (Node16). Renderer Vite code may use extensionless imports.
- Electron's npm package downloads a binary at install time; `npm run build` does not launch the GUI.

## How agents use this

- **Explorer and planner:** read this first. Use the glossary's terms in specs.
- **Developer and qa-engineer:** respect the business rules and use the listed test doubles for integrations.
- **Anyone:** when you learn a non-obvious fact, propose an addition with its source (`file:line`, a doc or a person).
