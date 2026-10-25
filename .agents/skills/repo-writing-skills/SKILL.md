---
name: repo-writing-skills
description: Creates or updates a skill in .agents/skills following the open Agent Skills spec and this repo's role-/repo-/stack- naming. Use when the project's language or stack is decided (create its stack skill), when a repo procedure is repeated or explained twice (create a repo skill), when a new role is needed (create a role skill), or when asked to add, write or improve a skill.
metadata:
  type: repo
---
# Writing skills

Skills live in `.agents/skills/<name>/SKILL.md` and follow the open [Agent Skills spec](https://agentskills.io/specification).
After adding or renaming a skill, **add it to the Skills index in `AGENTS.md`** (and agents to the Agents table). That index is how every agent finds it.

## Pick the type, then name it with its prefix

Every skill name starts with its type, so the kind is obvious in any skill list and they sort together.

| Prefix | Type | Encodes | Example names | Template |
| --- | --- | --- | --- | --- |
| `role-` | **Role** | *How* a persona does its job, with a defined output | `role-reviewing-code`, `role-designing-test-cases` | [assets/role-skill.md](assets/role-skill.md) |
| `repo-` | **Repo** (= this project) | Everything specific to this project: **intent** (goals, principles, decisions), **knowledge** (domain, glossary, architecture), **review rules**, and **procedures** | `repo-project-intent`, `repo-domain-knowledge`, `repo-review-rules`, `repo-adding-endpoints` | [assets/repo-skill.md](assets/repo-skill.md) |
| `stack-` | **Stack** (language, framework, tool) | Conventions for a technology *as used in this repo* | `stack-python`, `stack-fastapi`, `stack-react`, `stack-postgres` | [assets/stack-skill.md](assets/stack-skill.md) |

Naming rules:
- Role skills and repo *procedures* use `<prefix>-<verb-ing>-<noun>` (`role-writing-tests`, `repo-cutting-releases`).
  Repo *knowledge*, *intent* and *rules* use a noun (`repo-domain-knowledge`, `repo-review-rules`). Stack skills use `stack-<technology>`.
- Keep names to 64 characters or fewer, lowercase, and hyphenated. The folder name must equal `name` exactly.
- Set `metadata.type` to match the prefix (`role`, `repo` or `stack`).

## Agents use the same prefixes

Need a **persona that runs in its own context** (a subagent the orchestrator dispatches)? Create `.agents/agents/<name>.md` from
[assets/agent.md](assets/agent.md) and name it with the same prefixes:

| Prefix | Agent is | Examples |
| --- | --- | --- |
| `role-` | a generic persona usable in any project | `role-developer`, `role-qa-engineer`, `role-code-reviewer` |
| `repo-` | an expert in **this project** (its intent, domain and rules) | `repo-domain-expert`, `repo-billing-expert` |
| `stack-` | an expert in a language, framework or tool | `stack-python-reviewer`, `stack-react-tester` |

Keep agents thin: a responsibility, a boundary, an output shape, and the skills they load. Put the know-how in skills so humans and
other agents can reuse it. Add the agent to the Agents table in `AGENTS.md`. Create a `stack-` agent only when a generic `role-`
agent plus a `stack-` skill isn't enough.

Where else knowledge can go:
- A one-line rule that applies to every task belongs in `AGENTS.md`, not in a skill.
- A rule for one directory belongs in a nested `AGENTS.md` in that directory.

## When to create each type

- **Stack skill:** create it as soon as the stack is chosen (for example "we'll use Python + FastAPI"). Read the repo's actual
  tooling first (`pyproject.toml`, `package.json`, linter configs). Then write the conventions that are *true for this repo*:
  layout, commands, typing, error handling, test idioms. Make one skill per language, and give a framework its own skill (`stack-fastapi`)
  only if it has many rules of its own.
- **Repo skill:** keep the three shipped ones current: `repo-project-intent` (why), `repo-domain-knowledge` (what) and
  `repo-review-rules` (project checks). Propose an edit when you learn something durable. Create a new repo procedure skill the
  second time you explain or rediscover the same multi-step procedure. Split a knowledge skill when it grows past about 300 lines,
  for example `repo-billing-knowledge`.
- **Role skill:** create it when a recurring kind of work needs its own checklist and output format, for example a migrations
  reviewer or an accessibility auditor.

## Spec rules (validated by tools; keep them)

- `name`: 1–64 characters, lowercase letters, digits and hyphens, no leading, trailing or double hyphens. It **must equal the folder name**.
- `description`: up to 1024 characters. Say **what it does and when to use it**, and front-load the trigger words. Agents choose
  skills from this line alone.
- Optional fields: `license`, `compatibility`, `metadata` (string → string, here `type: role|repo|stack`), and `allowed-tools`.
- Keep the body under about 500 lines. Move detail into `references/*.md`, one level deep, and link to it with a relative path.
  Templates go in `assets/` and runnable helpers in `scripts/`.

## Quality bar

- Be concrete: real paths and the real commands from `AGENTS.md`.
- One job per skill. If the description needs "and also", split it.
- Write imperative steps, give an example of the expected output, and name the common pitfalls.
- No secrets. Don't instruct agents to download and run remote code.
