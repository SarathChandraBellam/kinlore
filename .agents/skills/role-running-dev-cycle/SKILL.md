---
name: role-running-dev-cycle
description: Orchestrates a change through Inception (spec, plan, test design) and Construction (implement, review, verify) using the role subagents in .agents/agents, with human approval gates and in-repo QA. Use when the user asks to build, add, fix or change anything non-trivial, or says "dev cycle" or "do it properly".
metadata:
  type: role
---
# Dev cycle (orchestrator)

You are the **orchestrator**. You plan the work, delegate it to subagents, check each gate, and talk to the human.
This cycle follows the AI-driven development lifecycle: the AI proposes, the human approves at gates, artifacts live in the repo,
and QA happens **before merge**, not after deployment.

## Flow

```
INCEPTION                                   CONSTRUCTION (one "bolt" per task batch)
explorer ─► planner ─► qa-engineer(design) ─► GATE 1 ─► developer ─► code-reviewer ─┬─► qa-engineer(verify) ─► GATE 2 ─► done
 (parallel ok)  spec+plan   test-cases.md    human        TDD          + security-   │      all gates green      human
                                             approves                  reviewer      └─ blocker/fail ─► developer (max 3 loops)
```

| Step | Agent | Skill(s) | Artifact | Gate to pass |
| --- | --- | --- | --- | --- |
| 1. Explore | `role-explorer` (one or more, parallel) | `role-exploring-codebase` | notes only | the relevant code and patterns are known |
| 2. Spec + plan | `role-planner` | `role-writing-specs`, `role-planning-changes` | `specs/<id>/spec.md`, `plan.md` | every criterion is testable; open questions answered |
| 3. Test design | `role-qa-engineer` (design) | `role-designing-test-cases` | `specs/<id>/test-cases.md` | every criterion has at least one test case |
| **Gate 1** | **human** | — | — | approves spec, plan and test cases |
| 4. Implement | `role-developer` | `role-implementing-plans`, `role-writing-tests` | code + tests | format and lint pass after each task |
| 5. Review | `role-code-reviewer` (+ `role-security-reviewer` in parallel when relevant) | `role-reviewing-code` | findings | no open blocker or major findings |
| 6. Verify | `role-qa-engineer` (verify) | `role-verifying-changes` | `specs/<id>/qa-report.md` | every quality gate in `AGENTS.md` is green; each criterion has evidence |
| **Gate 2** | **human** | — | — | reviews the qa-report and diff, then merges |

When a request or spec touches business rules, product decisions or trade-offs, ask `repo-domain-expert` to check it against
the project's intent and knowledge (read-only, so it can run in parallel with planning or review).

On a failure with an unclear cause, send it to `role-debugger` (`role-debugging-systematically`), then resume.

## Sizing (don't over-process)

| Size | Examples | Run |
| --- | --- | --- |
| **Trivial** | typo, config tweak, one-liner | steps 4 and 6 only, with inline notes and no `specs/` folder |
| **Normal** | a feature, a known bug | all steps, with spec and plan kept short (one page) |
| **Large or risky** | cross-module change, migration, public API, security | all steps, split into bolts of 3–5 tasks with Gate 1 per bolt |

## Delegation rules

1. **Brief every subagent fully.** It can't see this conversation. Give it the objective, the inputs (paths to the spec, plan and
   diff), the expected output format, its boundaries (read-only or not), and when to stop.
2. **Load the agent definition.** Read `.agents/agents/<name>.md` and pass its body as the subagent's instructions. If your CLI has
   a native agent with the same name, use that instead.
3. **Writes stay single-threaded.** Only one writer (`role-developer`, `role-qa-engineer` in automate mode, or `role-debugger`) at a time.
   Read-only agents (`role-explorer`, reviewers) may run in parallel.
4. **Review in a clean context.** Never review in the conversation that wrote the code.
5. **Use the model tier.** Each agent's `metadata.tier` maps to your CLI's models. See *Model tiers* in `AGENTS.md`.
6. **No subagents available?** Run the steps yourself in order, and re-read the diff from scratch before reviewing.

## Loop limits

A blocker or major finding, or a failing gate, sends the work back to **Implement**. After **3 loops**, stop. Report what's
blocking and ask the human. The spec or plan is probably wrong.

## Finish with

What changed · why (criterion IDs) · evidence (`qa-report.md` and the tail of the check output) · follow-ups.
