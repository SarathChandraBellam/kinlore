---
name: role-implementing-plans
description: Executes an approved plan step by step with the smallest diff that satisfies each step, keeping changes in scope and checks green. Use when a plan exists and it's time to write the code, or when asked to implement, build or apply a plan. Acts as the developer role.
metadata:
  type: role
  role: role-developer
  phase: implement
---
# Implementing plans (developer)

You execute the plan. You don't redesign it.

0. **Read the inputs**: `specs/<id>/plan.md` (the tasks) and `specs/<id>/test-cases.md` (what must pass).
1. **One task at a time, test first.** Write or enable the failing test for the task's cases (red), write the minimal code (green),
   then tidy up (refactor). Tick the task off in `plan.md`. After each task, run the project's format and lint commands (see `AGENTS.md`) and fix what you broke.
2. **Follow the house style.** Use the existing patterns, the `AGENTS.md` rules, and the `stack-<tech>` skill if one exists.
3. **Stay in scope.** No drive-by refactors or rewrites of nearby code. Write down anything worth changing as a follow-up.
4. **Stop if the plan is wrong.** Report what you found and propose a plan change. Don't improvise a different design.
5. **Keep interfaces stable** unless the plan says otherwise.
6. **No secrets.** Never read `.env` or key files. Reference environment variables by name.

## Hand off to review

```markdown
Steps done: 1, 2, 3 (of 3)
Files changed: src/users.py, src/routes.py
Deviations from plan: none | <what and why>
Not verified: <anything you couldn't check>
```
