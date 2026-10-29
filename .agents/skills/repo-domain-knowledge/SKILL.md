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

- `Person`, `Recording`, `Story`, `Keepsake`, `Consent`, `Transcript`, `Interview`, `TimelineEvent`, and `Recipe` live in `@kinlore/core`.
- Stories and recipes cite `recordingIds`. Answers play a real clip or return `unknown`.
- Consent `scope` is `recording` \| `archive` \| `export` \| `generated-voice`.
- A recording with `sealedUntil` in the future is not played and is not quoted.
- Entity ids match `[A-Za-z0-9_-]+`. Media paths cannot leave the archive root.
- Encryption is required for desktop family writes. The data key is not stored in the archive.

## Architecture map

| Component    | Path                          | Responsibility                                 | Talks to                                         |
| ------------ | ----------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| Renderer     | `apps/desktop/src/renderer`   | UI                                             | `window.kinlore` only                            |
| Preload      | `apps/desktop/src/preload.ts` | `contextBridge`                                | ipc-contract + ipcRenderer                       |
| Main         | `apps/desktop/src`            | Windows, IPC, archive session                  | storage, ask, interview, ingest, secrets, engine |
| Core         | `packages/core`               | Domain types and policy                        | nothing                                          |
| Interview    | `packages/interview`          | Question bank                                  | `@kinlore/core`                                  |
| Ask          | `packages/ask`                | Clip retrieval                                 | `@kinlore/core`                                  |
| Ingest       | `packages/ingest`             | Zip and subtitles                              | nothing                                          |
| Secrets      | `packages/secrets`            | Secret file                                    | `node:fs`                                        |
| Engine       | `packages/engine`             | Optional remote text; speech/voice unavailable | nothing                                          |
| Storage      | `packages/storage`            | Archive I/O and encryption                     | `@kinlore/core`, `node:fs`                       |
| IPC contract | `packages/ipc-contract`       | Channel names + `KinloreApi`                   | `@kinlore/core`                                  |

## Integrations

| System              | Purpose           | How we call it                        | Env vars (names only) | Test double         |
| ------------------- | ----------------- | ------------------------------------- | --------------------- | ------------------- |
| Filesystem          | Archive folder    | `node:fs/promises` in storage         | none                  | temp dirs in Vitest |
| Secret file         | Optional API keys | `FileSecretStore` outside the archive | none                  | temp dirs in Vitest |
| OS keychain / DPAPI | Not used yet      | passphrase and recovery key instead   | none                  | n/a                 |

OpenRouter is an optional main-process integration using a fixed HTTPS endpoint
and native fetch. Key and model configuration live in `FileSecretStore` outside
the archive. Tests mock fetch; never use real credentials or family data.

## Data flows

- Remote text: explicitly selected unsealed transcripts → exact system/user text
  preview with model/destination → one-use approval → revalidate archive, sources,
  configuration and export consent → OpenRouter → validate references → real clips
  or review-only drafts. Require export consent for all recording participants and
  transcript speakers. Recheck policy before returning results. No audio upload.
- Drafts are editable suggestions, never transcript words or automatic archive
  writes. Apply and save are separate user actions. Schema validation is not factual verification.
- Capture can omit words. In that case save the recording/interview without creating
  a transcript; real words can still be supplied at capture or by subtitle import.

- User picks a folder (or uses `<userData>/KinloreArchive`) → main `create`/`open` → JSON + media on disk.
- Renderer mutates the archive through `window.kinlore`. Main checks consent, seals, and path allowlists before it writes.
- Ask searches typed words and imported subtitles. A miss returns `unknown`.

## Gotchas

- `npm run typecheck` is `tsc -b` then renderer `tsc --noEmit`. Run it after packages can emit `.d.ts`.
- Relative imports in compiled packages use `.js` extensions (Node16). Renderer Vite code may use extensionless imports.
- Electron's npm package downloads a binary at install time; `npm run build` does not launch the GUI.

## How agents use this

- **Explorer and planner:** read this first. Use the glossary's terms in specs.
- **Developer and qa-engineer:** respect the business rules and use the listed test doubles for integrations.
- **Anyone:** when you learn a non-obvious fact, propose an addition with its source (`file:line`, a doc or a person).

## Encrypted desktop behavior

- New archives use `LocalJsonStorage.createWithCodec` with supplied wrapped keys;
  cryptography stays in `EncryptionProvider`/`ArchiveCodec`, not LocalJsonStorage.
- Existing plaintext archives may be read but cannot be edited until encrypted.
- `createArchive(rootPath, passphrase)` returns status and a recovery key once.
- Electron supplies `safeStorage` protection to `FileSecretStore`. No plaintext
  fallback is allowed when OS protection is unavailable. Old secret files migrate
  before credentials are returned; model settings are encrypted too.
- Archive mutations block assistance snapshots throughout async writes and
  invalidate preview tokens both before and after. This includes consent and seals.
- Interview persona is bounded caller text, not a generated fact or auto-saved
  profile. A selected person needs export consent before persona text is sent.
