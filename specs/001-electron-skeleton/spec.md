# Spec 001: Electron + TypeScript desktop skeleton

Status: approved · Owner: Kinlore contributors · Issue: scaffolding brief

## Problem

The repo is still the agentic-dev-starter template. Kinlore needs a local-first
desktop app, and the stack is Electron + TypeScript + Node — not the old
Tauri/Python mention. Contributors have nowhere to put domain types, archive
I/O, or a secure renderer.

## Goal

A clean, modular, open-source monorepo skeleton: typed packages, a portable
local archive, a sandboxed Electron shell with typed IPC, OSS docs, and CI
gates that pass without launching the GUI.

## Scope

- In: npm workspaces; `apps/desktop`; `packages/core`, `packages/storage`,
  `packages/ipc-contract`; strict TypeScript; ESLint + Prettier; Vitest for
  storage; OSS files; AGENTS.md / CLAUDE.md; GitHub templates and CI.
- Out (non-goals): AI/ASR, interviewer, WhatsApp/video import, encryption
  implementation, installers, accounts/servers, generated voice.

## Acceptance criteria

- **AC1**: Given a fresh clone, when `npm install` then
  `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`
  run, then each command exits 0.
- **AC2**: Given the repo, when inspecting workspaces, then `apps/desktop`,
  `packages/core`, `packages/storage`, and `packages/ipc-contract` exist, and
  packages export only their public `index` (no required deep imports).
- **AC3**: Given `packages/core`, when importing domain types, then `Person`,
  `Recording`, `Story`, `Keepsake`, and `Consent` are available.
- **AC4**: Given a temp directory, when creating then opening a local archive
  and writing people plus media, then the data round-trips as JSON + files
  under a documented KinloreArchive layout.
- **AC5** (error): Given a path that would escape the archive root, when
  writing or reading media, then storage rejects it.
- **AC6**: Given the Electron app, when the window is created, then
  `contextIsolation` is on, `nodeIntegration` is off, and the renderer talks
  to main only through a typed preload API from `packages/ipc-contract`.
- **AC7**: Given `StorageProvider` / `EncryptionProvider`, when reading the
  storage package, then encryption is a marked TODO/interface only (no DPAPI
  or Keychain implementation).
- **AC8**: Given the repo root, when opening OSS files, then README describes
  Kinlore and the Electron stack, LICENSE is Apache-2.0, and CONTRIBUTING,
  CODE_OF_CONDUCT, SECURITY, CHANGELOG, editorconfig, nvmrc, issue/PR
  templates, and CI (the same five check scripts) are present.
- **AC9**: Given TypeScript config, when compiling, then `strict` and
  `noUncheckedIndexedAccess` are on, and package tsconfigs extend a base.

## Non-functional

- NFR1: Local-first — nothing leaves the machine without explicit user action.
- NFR2: Simplest thing that works; no unused dependencies.
- NFR3: Archive format is open, documented, and portable.

## Open questions

- None. JSON metadata now; SQLite may replace it later behind `StorageProvider`.
