# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Copilot, Gemini CLI, Cursor, ...) and for humans.
This file is the **index**. Project rules live here, personas live in `.agents/agents/`, and know-how lives in `.agents/skills/`.

Claude Code: [CLAUDE.md](CLAUDE.md) is a pointer to this file.

## Project

Kinlore is a local-first desktop app that helps families keep stories told by
elders — in their own voices. This repo is the open-source Electron + TypeScript
skeleton: domain types, a portable archive folder, and a sandboxed desktop shell.
Optional OpenRouter text assistance is available with per-request approval.
ASR and generated voice are not implemented; imports and encrypted local desktop archives are supported.

Details: [`repo-project-intent`](.agents/skills/repo-project-intent/SKILL.md) and
[`repo-domain-knowledge`](.agents/skills/repo-domain-knowledge/SKILL.md).

## Stack

Electron (main + preload + React/Vite renderer) and TypeScript on Node.js 20+,
as an npm-workspace monorepo. Strict TypeScript (`strict`, `noUncheckedIndexedAccess`).
Vitest, ESLint (flat, typescript-eslint), Prettier.

## Architecture

```
renderer (React, isolated) --preload KinloreApi--> main (Node)
                                  |                      |
                          @kinlore/ipc-contract    storage, ask, interview,
                                                   ingest, secrets, engine
                                                         |
                                                   @kinlore/core
```

The renderer has no Node and no filesystem. Main owns the archive. Packages
talk through public `index` exports only.

## Package map

| Path                    | Package                 | Responsibility                                |
| ----------------------- | ----------------------- | --------------------------------------------- |
| `apps/desktop`          | `@kinlore/desktop`      | Electron main, preload, React UI              |
| `packages/core`         | `@kinlore/core`         | Domain types, parsers, consent and seal rules |
| `packages/storage`      | `@kinlore/storage`      | JSON archive and optional encryption          |
| `packages/interview`    | `@kinlore/interview`    | Local question bank and follow-ups            |
| `packages/ask`          | `@kinlore/ask`          | Answers that cite real transcript clips       |
| `packages/ingest`       | `@kinlore/ingest`       | File, zip, and subtitle import                |
| `packages/secrets`      | `@kinlore/secrets`      | Secret file outside the archive               |
| `packages/engine`       | `@kinlore/engine`       | Speech and voice engine interfaces            |
| `packages/ipc-contract` | `@kinlore/ipc-contract` | IPC channel names and `KinloreApi`            |

## Archive / data model

Archive root: a user-chosen folder, or `<app.getPath('userData')>/KinloreArchive`.

```
<archive>/
  kinlore.json                 # format: kinlore-archive, version: 1 (2 when encrypted)
  people/<id>.json
  recordings/<id>.json
  recordings/media/<file>
  stories/<id>.json
  keepsakes/<id>.json
  keepsakes/media/<file>
  consent/<id>.json
  transcripts/<id>.json
  interviews/<id>.json
  timeline/<id>.json
  recipes/<id>.json
  encryption.json              # wrapped keys only, when encryption is on
```

Pretty-printed JSON + media files. Portable: copy the folder. Desktop archives require encryption (`AesGcmEncryption` via `ArchiveCodec`).
Legacy plaintext archives are read-only until encrypted in Settings. `LocalJsonStorage` stays
plaintext until that codec is set. API keys live outside the archive.

Entity ids are `[A-Za-z0-9_-]+` (UUIDs are fine). Media paths must stay inside
the archive root.

## Commands

| Task         | Command                |
| ------------ | ---------------------- |
| Install      | `npm install`          |
| Run locally  | `npm run dev`          |
| Format       | `npm run format`       |
| Format check | `npm run format:check` |
| Lint         | `npm run lint`         |
| Type check   | `npm run typecheck`    |
| Test (all)   | `npm test`             |
| Build        | `npm run build`        |
| Package      | `npm run dist`         |

## Quality gates

These run **in the repo, before merge**. `role-verifying-changes` runs all of them, and work is done only when all pass.

| Gate                      | Command                | Required                          |
| ------------------------- | ---------------------- | --------------------------------- |
| Format check              | `npm run format:check` | yes                               |
| Lint                      | `npm run lint`         | yes                               |
| Type check                | `npm run typecheck`    | yes                               |
| Unit tests                | `npm test`             | yes                               |
| Integration tests         | —                      | when there are integration points |
| Coverage of changed lines | —                      | recommended later                 |
| Dependency / secret scan  | —                      | recommended                       |

## Coding standards

- Strict TypeScript. No `any`. Prefer `import type` for types.
- Public package API is the `.` export. No deep imports (`@kinlore/core/src/...`).
- Renderer: React only. Do not import `@kinlore/storage`, `node:fs`, or `electron`.
- Main: `contextIsolation: true`, `nodeIntegration: false`. IPC types live in
  `@kinlore/ipc-contract`; keep preload a thin `contextBridge` wrapper.
- Tests next to the code as `*.test.ts`. Storage tests use a temp directory.
- Simplest thing that works. Do not add unused dependencies.

## Security rules

- Local-first. Nothing leaves the machine without an explicit user action.
- Never read, print, or commit secrets (`.env`, keys). Reference env vars by name.
- Do not implement analytics, accounts, or background uploads.
- Do not implement encryption in `LocalJsonStorage`; use `EncryptionProvider`.
- Refuse path traversal out of the archive root.

## Roadmap

1. Record and listen — interviews, family questions, real-clip answers, keepsakes, English and Telugu.
2. Understand — WhatsApp/video import, adaptive interviewer, ask the whole family, timeline, recipes, BYO keys.
3. Extend — sealed recordings, opt-in style voice, encryption with a recovery key, more languages.

## Review and release

Feature branch → PR to `main` → the `ci` status check must pass → maintainer
approval → merge. A merge to `main` runs `ci` again and publishes an unsigned
GitHub prerelease tagged `staging-<short sha>`. Production: bump version and
CHANGELOG via PR, then Actions → **release-production** → Run workflow with
the version; a maintainer approves the `production` environment and the
release is published.

Details: [CONTRIBUTING.md](CONTRIBUTING.md). Workflows live in
`.github/workflows/`.

## How we work

For anything non-trivial, the main agent acts as **orchestrator** and follows
[`role-running-dev-cycle`](.agents/skills/role-running-dev-cycle/SKILL.md):

1. **Inception**: `role-explorer` maps the code, `role-planner` writes the spec and plan, and `role-qa-engineer` designs test cases from the
   acceptance criteria. **Gate 1:** the human approves.
2. **Construction**: `role-developer` implements test-first, `role-code-reviewer` (and `role-security-reviewer` when relevant) reviews in a clean
   context, and `role-qa-engineer` verifies all quality gates. **Gate 2:** the human reviews the QA report and merges.

Artifacts live in `specs/<id>-<slug>/`: `spec.md`, `plan.md`, `test-cases.md`, `qa-report.md`.
Trivial changes skip the specs and still pass the quality gates.

## Agents (subagents the orchestrator dispatches)

Agents use the same prefixes as skills:

- **`role-`**: a generic persona.
- **`repo-`**: an expert in this project.
- **`stack-`**: an expert in a language or framework, for example `stack-python-reviewer`, created once the stack is chosen.

To dispatch an agent, read `.agents/agents/<name>.md` and start a subagent with its body as instructions. If your CLI has no
subagents, play the role yourself. Only **one writer at a time**. Read-only agents may run in parallel.

| Agent                                                                | Phase                    | Tier     | Access     | Skills                                                                                                                |
| -------------------------------------------------------------------- | ------------------------ | -------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| [`role-explorer`](.agents/agents/role-explorer.md)                   | inception                | fast     | read-only  | role-exploring-codebase, repo-domain-knowledge                                                                        |
| [`role-planner`](.agents/agents/role-planner.md)                     | inception                | strong   | read-only  | role-writing-specs, role-planning-changes, repo-project-intent, repo-domain-knowledge                                 |
| [`role-qa-engineer`](.agents/agents/role-qa-engineer.md)             | inception + construction | balanced | tests only | role-designing-test-cases, role-writing-tests, role-verifying-changes, role-fixing-flaky-tests, repo-domain-knowledge |
| [`role-developer`](.agents/agents/role-developer.md)                 | construction             | balanced | read-write | role-implementing-plans, role-writing-tests, repo-domain-knowledge, stack-typescript, stack-electron                  |
| [`role-code-reviewer`](.agents/agents/role-code-reviewer.md)         | construction             | strong   | read-only  | role-reviewing-code, repo-review-rules, repo-project-intent                                                           |
| [`role-security-reviewer`](.agents/agents/role-security-reviewer.md) | construction             | strong   | read-only  | role-reviewing-code, repo-review-rules                                                                                |
| [`role-debugger`](.agents/agents/role-debugger.md)                   | any                      | strong   | read-write | role-debugging-systematically, role-writing-tests                                                                     |
| [`repo-domain-expert`](.agents/agents/repo-domain-expert.md)         | inception + review       | strong   | read-only  | repo-project-intent, repo-domain-knowledge, repo-review-rules                                                         |

### Model tiers

Agents declare a **tier**, not a model name. Map each tier to whatever your orchestrator offers:

| Tier         | Use for                                                    | Pick                                                                                                    |
| ------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **strong**   | judgment: planning, review, security, hard debugging       | your most capable reasoning model, ideally from a different model family than the developer for reviews |
| **balanced** | volume work with clear instructions: implementation, tests | your default coding model, or inherit the session model                                                 |
| **fast**     | read-only lookups, run many in parallel                    | your smallest, fastest model                                                                            |

If unsure, **inherit the orchestrator's model**. Escalate a task to **strong** after a failed attempt.

## Skills

Skills follow the open [Agent Skills spec](https://agentskills.io/specification). Each name starts with its type:
**`role-`** (how a persona works), **`repo-`** (everything specific to this project: intent, knowledge, review rules, procedures), and **`stack-`** (conventions for the language,
framework or tools). If your agent doesn't load them automatically,
read the matching `SKILL.md` before that kind of task.

### Role skills: how each persona does its job

| Skill                                                                                    | Persona                          | Use when                                                   |
| ---------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------- |
| [`role-running-dev-cycle`](.agents/skills/role-running-dev-cycle/SKILL.md)               | orchestrator                     | building, adding, fixing or changing anything non-trivial  |
| [`role-exploring-codebase`](.agents/skills/role-exploring-codebase/SKILL.md)             | explorer                         | "where is", "how does", or before touching unfamiliar code |
| [`role-writing-specs`](.agents/skills/role-writing-specs/SKILL.md)                       | planner                          | requirements, acceptance criteria, user stories            |
| [`role-planning-changes`](.agents/skills/role-planning-changes/SKILL.md)                 | planner                          | design notes, task breakdown, test strategy                |
| [`role-designing-test-cases`](.agents/skills/role-designing-test-cases/SKILL.md)         | qa-engineer                      | test cases from acceptance criteria, before code           |
| [`role-implementing-plans`](.agents/skills/role-implementing-plans/SKILL.md)             | developer                        | executing an approved plan, test-first                     |
| [`role-writing-tests`](.agents/skills/role-writing-tests/SKILL.md)                       | qa-engineer, developer           | automating test cases, regression tests                    |
| [`role-reviewing-code`](.agents/skills/role-reviewing-code/SKILL.md)                     | code-reviewer, security-reviewer | reviewing a diff or PR                                     |
| [`role-verifying-changes`](.agents/skills/role-verifying-changes/SKILL.md)               | qa-engineer                      | the final in-repo QA gate, before done or a PR             |
| [`role-fixing-flaky-tests`](.agents/skills/role-fixing-flaky-tests/SKILL.md)             | qa-engineer                      | intermittent or CI-only test failures                      |
| [`role-debugging-systematically`](.agents/skills/role-debugging-systematically/SKILL.md) | debugger                         | failures whose cause isn't obvious                         |

### Repo skills: everything specific to this project

| Skill                                                                    | Kind      | Use when                                                                                        |
| ------------------------------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------- |
| [`repo-project-intent`](.agents/skills/repo-project-intent/SKILL.md)     | intent    | planning or reviewing; weighing trade-offs; checking goals, non-goals, principles and decisions |
| [`repo-domain-knowledge`](.agents/skills/repo-domain-knowledge/SKILL.md) | knowledge | business terms, core entities, architecture, integrations, gotchas                              |
| [`repo-review-rules`](.agents/skills/repo-review-rules/SKILL.md)         | review    | every review: this project's boundaries, required and banned patterns, budgets                  |
| [`repo-writing-skills`](.agents/skills/repo-writing-skills/SKILL.md)     | procedure | adding or changing a skill or an agent                                                          |

### Stack skills: language, framework and tool conventions

| Skill                                                          | Use when                                          |
| -------------------------------------------------------------- | ------------------------------------------------- |
| [`stack-typescript`](.agents/skills/stack-typescript/SKILL.md) | editing any `.ts` / `.tsx` file                   |
| [`stack-electron`](.agents/skills/stack-electron/SKILL.md)     | Electron main, preload, IPC, or desktop packaging |

## Rules

- Use the commands and gates above. Don't invent alternatives.
- Stay in scope. Note follow-ups instead of making drive-by changes.
- Never read, print or commit secrets (`.env`, keys). Reference environment variables by name.
- Ask before destructive commands, dependency installs, network calls, or writing outside the repo.
- Don't commit, push or open PRs unless asked.
- When you add or rename a skill or agent, update the tables above.
