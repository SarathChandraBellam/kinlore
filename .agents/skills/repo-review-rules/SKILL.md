---
name: repo-review-rules
description: This project's own review checklist - rules specific to this codebase that generic review misses (architecture boundaries, banned patterns, required patterns, performance budgets, compliance). Use together with role-reviewing-code whenever reviewing a diff or PR in this repo.
metadata:
  type: repo
  kind: review
---

# Project review rules

`role-reviewing-code` covers generic quality. This skill holds the rules **only this project** has. Every rule needs a reason,
so reviewers apply it with judgment rather than blindly.

## Architecture boundaries

| Rule                                                                        | Why                                 | Severity if broken |
| --------------------------------------------------------------------------- | ----------------------------------- | ------------------ |
| Import `@kinlore/*` only from the package root, never `/src/`               | keeps public API small              | major              |
| Renderer must not import `@kinlore/storage`, `node:fs`, or `electron`       | isolation; filesystem stays in main | blocker            |
| Preload only exposes `KinloreApi`; no general `ipcRenderer`                 | typed, auditable IPC                | major              |
| `packages/core` does not import Electron, React, or `node:fs`               | domain stays portable               | major              |
| Window `webPreferences`: `contextIsolation: true`, `nodeIntegration: false` | Electron security baseline          | blocker            |

## Required patterns

- New IPC channels are added to `@kinlore/ipc-contract` first, then preload, then main.
- Archive writes go through `StorageProvider` / `Archive`, not ad-hoc `writeFile` in main.
- Entity ids are validated before they become filenames.

## Banned patterns

- Automatic network calls, analytics, accounts, background uploads, or audio uploads.
- Remote text outside the explicitly reviewed OpenRouter flow: require a one-use
  approval, exact text/model/destination preview, and export consent from every
  participant. Sealed or unrelated transcript text must never be sent.
- Model-generated quotes/transcripts or automatic acceptance of AI drafts.
- Implementing encryption inside `LocalJsonStorage` instead of `EncryptionProvider`.
- `any`, unchecked indexed access, or deep workspace imports.
- Committing `KinloreArchive/`, `.env`, keys, or real family media.

## Budgets and non-functional rules

- Do not add a dependency that is unused after the change.
- Do not add native addons without a plan for Windows, macOS, and Linux.

## Compliance and data

- Treat recordings, transcripts, and people names as sensitive family data.
- Logs must not include archive contents or file bytes.

## How agents use this

- **code-reviewer and security-reviewer:** apply every rule here after the generic checklist, and cite the rule in each finding.
- **Anyone:** when the same review comment appears twice, propose it as a new rule here.
