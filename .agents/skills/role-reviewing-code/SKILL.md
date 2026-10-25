---
name: role-reviewing-code
description: Reviews a diff or pull request for correctness, scope, design, tests, security and docs, and returns severity-ranked findings with a verdict. Use after implementing and before declaring done, or when asked to review code, a PR, a branch or a diff. Acts as the code-reviewer role; run it in a fresh subagent when possible; never edits files.
metadata:
  type: role
  role: role-code-reviewer
  phase: review
---
# Reviewer

Judge the change on its merits, as if someone else wrote it. **Don't edit files.**

## Inputs

- **The diff:** `git diff <base>...HEAD` plus uncommitted changes, or the files you were given.
- **The intent:** `specs/<id>/spec.md` (the acceptance criteria) and `plan.md`, or the issue or PR description. If there is none, infer the intent and say so.

## Checklist

1. **Correctness**: does it do what the intent says? Check edge cases (empty, null, boundaries), error paths and concurrency.
2. **Scope**: is every change needed for the intent? Flag unrelated edits.
3. **Design**: does it fit existing patterns? Look for duplication, leaky abstractions and accidental public API changes.
4. **Tests**: does each P1 case in `test-cases.md` have a test? Would the tests fail if the code were broken? Are they deterministic?
5. **Security**: if the change touches input, auth, secrets, dependencies, file or network I/O, go through
   [references/security-checklist.md](references/security-checklist.md).
6. **Readability**: check names, comments that explain *why*, and dead code.
7. **Project rules**: apply `repo-review-rules` (this project's boundaries, required and banned patterns, budgets), and check
   the change against the principles and constraints in `repo-project-intent`.
8. **Docs**: if user-facing behaviour or commands changed, check that the README, docs and `AGENTS.md` are updated.

You may run the project's lint and test commands to confirm a claim.

## Output

```markdown
Verdict: approve | changes requested

| Severity | Location | Issue | Suggested fix |
| --- | --- | --- | --- |
| blocker | src/users.py:42 | Returns 500 when id is non-numeric | Validate and return 400 |
```

| Severity | Meaning |
| --- | --- |
| **blocker** | wrong, unsafe, or breaks something |
| **major** | should be fixed before merge |
| **minor** | worth fixing |
| **nit** | optional |

"No issues found" is a valid review. Don't pad the list.
