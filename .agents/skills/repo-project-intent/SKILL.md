---
name: repo-project-intent
description: This project's intent - why it exists, who it serves, goals and non-goals, guiding principles, constraints and key decisions. Use before planning or reviewing any change, when weighing trade-offs, or when a request may conflict with the project's direction.
metadata:
  type: repo
  kind: intent
---

# Project intent

The "why" behind every decision. The planner reads this before writing a spec, and the reviewer checks changes against it.
**Keep it short and current.** Agents propose edits; a human approves them.

## Purpose

Kinlore helps families keep stories told by elders, in their own voices. It is a
local-first desktop app: recordings and metadata stay in a portable archive on
the family's computer. No account, server, or subscription.

## Users and their jobs

| User          | What they need to get done                                                        |
| ------------- | --------------------------------------------------------------------------------- |
| Family member | Record an elder, replay a real clip that answers a question, keep keepsakes       |
| Elder         | Speak in their language (Telugu, Hindi, Tamil, English, code-mixing) with consent |
| Contributor   | Add features without breaking local-first rules or the archive format             |

## Goals (this quarter / release)

- Record interviews, import recordings, and answer from real clips
- Keepsakes, a spoken cookbook, a timeline, and sealed recordings
- English, Telugu, Hindi, and Tamil questions
- Opt-in encryption with a recovery key; no network calls by default
- Quality gates (lint, format, typecheck, test, build) that pass in CI
- Staging and production releases that publish installer assets

## Non-goals

- Cloud accounts, Kinlore-hosted models, subscriptions, or analytics
- Bundling speech or voice model weights
- Sending audio or questions to an API in this build
- Generated voice audio (the control stays off until a consented local model exists)

## Principles (rank-ordered: when they conflict, the higher one wins)

1. Local-first: nothing leaves the machine without an explicit user action
2. Real recordings over generated media; never invent memories
3. Consent is a first-class entity, not a footer
4. Open, portable archive over a proprietary database
5. Simplest thing that works; no unused dependencies

## Constraints

- Desktop only (Electron). Renderer is isolated (`contextIsolation`, no `nodeIntegration`).
- Node.js 20+. Apache-2.0.
- Family media must not be committed or uploaded by tooling.

## Decisions log

| Date       | Decision                     | Why                                                                 | Alternatives rejected     |
| ---------- | ---------------------------- | ------------------------------------------------------------------- | ------------------------- |
| 2026-10-25 | Electron + TypeScript + Node | Matches the current product brief; one language across main and UI  | Tauri/Python (old README) |
| 2026-10-25 | JSON files + media folder    | Open and portable; no native SQLite binding yet                     | SQLite now                |
| 2026-10-26 | Local product, engines empty | Ship the archive experience without inventing speech or calling out | Bundled ASR, remote APIs  |
| 2026-10-26 | Passphrase + recovery key    | Opt-in encryption outside `LocalJsonStorage`                        | Encrypting by default     |
| 2026-10-25 | npm workspaces               | Template had no pnpm lockfile; brief allows npm                     | pnpm, yarn                |

## How agents use this

- **Planner:** flag any request that conflicts with a non-goal, principle or constraint before planning it.
- **Reviewer:** a change that violates a principle or constraint is a **major** finding.
- **Anyone:** when a new decision is made in a conversation, propose a row for the decisions log.
