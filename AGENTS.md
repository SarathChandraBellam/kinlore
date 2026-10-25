# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Copilot, Gemini CLI, Cursor, ...) and for humans.
This file is the **index**. Project rules live here, personas live in `.agents/agents/`, and know-how lives in `.agents/skills/`.

## Project

<!-- Fill in: one or two sentences. Details live in repo-project-intent and repo-domain-knowledge. -->
_TBD_

## Stack

<!-- Fill in once decided, e.g. "Python 3.12, FastAPI, PostgreSQL". -->
_Not decided yet._ When it's decided, create the stack skills (see **Stack skills**).

## Commands

<!-- Fill in the real commands. Agents use these and never guess. -->
| Task | Command |
| --- | --- |
| Install | _TBD_ |
| Run locally | _TBD_ |
| Format | _TBD_ |
| Test (all) | _TBD_ |

## Quality gates

These run **in the repo, before merge**. `role-verifying-changes` runs all of them, and work is done only when all pass.

| Gate | Command | Required |
| --- | --- | --- |
| Format check | _TBD_ | yes |
| Lint | _TBD_ | yes |
| Type check | _TBD_ | if the language has one |
| Unit tests | _TBD_ | yes |
| Integration tests | _TBD_ | yes, once there are integration points |
| Coverage of changed lines | _TBD_ | target: _TBD_ |
| Dependency / secret scan | _TBD_ | recommended |

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

| Agent | Phase | Tier | Access | Skills |
| --- | --- | --- | --- | --- |
| [`role-explorer`](.agents/agents/role-explorer.md) | inception | fast | read-only | role-exploring-codebase, repo-domain-knowledge |
| [`role-planner`](.agents/agents/role-planner.md) | inception | strong | read-only | role-writing-specs, role-planning-changes, repo-project-intent, repo-domain-knowledge |
| [`role-qa-engineer`](.agents/agents/role-qa-engineer.md) | inception + construction | balanced | tests only | role-designing-test-cases, role-writing-tests, role-verifying-changes, role-fixing-flaky-tests, repo-domain-knowledge |
| [`role-developer`](.agents/agents/role-developer.md) | construction | balanced | read-write | role-implementing-plans, role-writing-tests, repo-domain-knowledge |
| [`role-code-reviewer`](.agents/agents/role-code-reviewer.md) | construction | strong | read-only | role-reviewing-code, repo-review-rules, repo-project-intent |
| [`role-security-reviewer`](.agents/agents/role-security-reviewer.md) | construction | strong | read-only | role-reviewing-code, repo-review-rules |
| [`role-debugger`](.agents/agents/role-debugger.md) | any | strong | read-write | role-debugging-systematically, role-writing-tests |
| [`repo-domain-expert`](.agents/agents/repo-domain-expert.md) | inception + review | strong | read-only | repo-project-intent, repo-domain-knowledge, repo-review-rules |

<!-- stack- agents: add when the stack is chosen and generic roles aren't enough, e.g.
| [`stack-python-reviewer`](.agents/agents/stack-python-reviewer.md) | review | strong | read-only | role-reviewing-code, stack-python | -->

### Model tiers

Agents declare a **tier**, not a model name. Map each tier to whatever your orchestrator offers:

| Tier | Use for | Pick |
| --- | --- | --- |
| **strong** | judgment: planning, review, security, hard debugging | your most capable reasoning model, ideally from a different model family than the developer for reviews |
| **balanced** | volume work with clear instructions: implementation, tests | your default coding model, or inherit the session model |
| **fast** | read-only lookups, run many in parallel | your smallest, fastest model |

If unsure, **inherit the orchestrator's model**. Escalate a task to **strong** after a failed attempt.

## Skills

Skills follow the open [Agent Skills spec](https://agentskills.io/specification). Each name starts with its type:
**`role-`** (how a persona works), **`repo-`** (everything specific to this project: intent, knowledge, review rules, procedures), and **`stack-`** (conventions for the language,
framework or tools). If your agent doesn't load them automatically,
read the matching `SKILL.md` before that kind of task.

### Role skills: how each persona does its job

| Skill | Persona | Use when |
| --- | --- | --- |
| [`role-running-dev-cycle`](.agents/skills/role-running-dev-cycle/SKILL.md) | orchestrator | building, adding, fixing or changing anything non-trivial |
| [`role-exploring-codebase`](.agents/skills/role-exploring-codebase/SKILL.md) | explorer | "where is", "how does", or before touching unfamiliar code |
| [`role-writing-specs`](.agents/skills/role-writing-specs/SKILL.md) | planner | requirements, acceptance criteria, user stories |
| [`role-planning-changes`](.agents/skills/role-planning-changes/SKILL.md) | planner | design notes, task breakdown, test strategy |
| [`role-designing-test-cases`](.agents/skills/role-designing-test-cases/SKILL.md) | qa-engineer | test cases from acceptance criteria, before code |
| [`role-implementing-plans`](.agents/skills/role-implementing-plans/SKILL.md) | developer | executing an approved plan, test-first |
| [`role-writing-tests`](.agents/skills/role-writing-tests/SKILL.md) | qa-engineer, developer | automating test cases, regression tests |
| [`role-reviewing-code`](.agents/skills/role-reviewing-code/SKILL.md) | code-reviewer, security-reviewer | reviewing a diff or PR |
| [`role-verifying-changes`](.agents/skills/role-verifying-changes/SKILL.md) | qa-engineer | the final in-repo QA gate, before done or a PR |
| [`role-fixing-flaky-tests`](.agents/skills/role-fixing-flaky-tests/SKILL.md) | qa-engineer | intermittent or CI-only test failures |
| [`role-debugging-systematically`](.agents/skills/role-debugging-systematically/SKILL.md) | debugger | failures whose cause isn't obvious |

### Repo skills: everything specific to this project

| Skill | Kind | Use when |
| --- | --- | --- |
| [`repo-project-intent`](.agents/skills/repo-project-intent/SKILL.md) | intent | planning or reviewing; weighing trade-offs; checking goals, non-goals, principles and decisions |
| [`repo-domain-knowledge`](.agents/skills/repo-domain-knowledge/SKILL.md) | knowledge | business terms, core entities, architecture, integrations, gotchas |
| [`repo-review-rules`](.agents/skills/repo-review-rules/SKILL.md) | review | every review: this project's boundaries, required and banned patterns, budgets |
| [`repo-writing-skills`](.agents/skills/repo-writing-skills/SKILL.md) | procedure | adding or changing a skill or an agent |

Fill in the first three early. Agents propose updates as they learn, and a human approves them.

<!-- Add more as they emerge: procedures (repo-adding-endpoints, repo-cutting-releases) or knowledge splits (repo-billing-knowledge).
     Rule: the second time something is explained, make it a repo skill. -->

### Stack skills: language, framework and tool conventions

_None yet._ Once the stack is decided, an agent creates one `stack-<tech>` skill per language (and per major framework if
needed) with `repo-writing-skills`, based on the repo's real tooling, and adds them here.

<!-- e.g.
| [`stack-python`](.agents/skills/stack-python/SKILL.md) | editing any .py file |
| [`stack-fastapi`](.agents/skills/stack-fastapi/SKILL.md) | routes, dependencies, request/response models |
-->

## Rules

- Use the commands and gates above. Don't invent alternatives.
- Stay in scope. Note follow-ups instead of making drive-by changes.
- Never read, print or commit secrets (`.env`, keys). Reference environment variables by name.
- Ask before destructive commands, dependency installs, network calls, or writing outside the repo.
- Don't commit, push or open PRs unless asked.
- When you add or rename a skill or agent, update the tables above.
