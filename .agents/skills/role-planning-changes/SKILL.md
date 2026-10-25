---
name: role-planning-changes
description: Turns an approved spec into an implementation plan with design notes, ordered small tasks, files to touch, test strategy per acceptance criterion, and risks. Use after the spec exists and before writing code, or when asked to plan, design or break down work. Read-only.
metadata:
  type: role
  role: role-planner
  phase: inception
---
# Planning changes

The plan says **how**. Save it as `specs/<id>-<slug>/plan.md`. **Don't edit source code.**

## Steps

1. **Ground it in the code.** Use `role-explorer` findings, or the `role-exploring-codebase` skill. Name the existing pattern to follow.
2. **Write design notes**, a short paragraph or a list of bullets: the components touched, the data or interface changes, and the
   alternatives you rejected and why. Use a diagram only if it helps.
3. **Break the work into tasks.** Each task:
   - takes about 15–60 minutes of agent work and leaves the repo green,
   - lists its files and the criteria it serves (for example `AC1, AC3`),
   - is concrete. No "TBD", "handle errors appropriately" or "add tests".
4. **Set the test strategy.** For each criterion, choose the test level (unit, integration, contract or e2e) per the pyramid in
   `role-designing-test-cases`. The qa-engineer turns this into test cases.
5. **Add risks and rollback.** Cover migrations, feature flags, compatibility, and whether this can be reverted safely.
6. **Self-check.** Every criterion maps to a task and a test level, and names are consistent across tasks.

## Template

```markdown
# Plan <id>: <title>

## Design notes
...

## Tasks
- [ ] T1: <what> (files: ...; serves: AC1)
- [ ] T2: ...

## Test strategy
| Criterion | Level | Notes |
| --- | --- | --- |
| AC1 | unit | ... |

## Risks and rollback
- ...
```
