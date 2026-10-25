---
name: role-verifying-changes
description: Final in-repo QA gate. Runs every quality gate defined in AGENTS.md (format, lint, types, tests, coverage, security scans), maps each acceptance criterion to passing evidence, and writes a QA report. Use before declaring any change done, before opening a PR, or when asked to verify, QA or sign off.
metadata:
  type: role
  role: role-qa-engineer
  phase: construction
---
# Verifying changes

"It should work" isn't evidence. Run things.

## Steps

1. **Run every gate** listed under *Quality gates* in `AGENTS.md`, in order, and capture the exit code and the last lines of output.
   If a gate isn't defined yet, report it as **missing** rather than skipping it silently.
2. **Trace the criteria.** For each criterion, name the test case and the test that proves it, and confirm the test ran and passed.
3. **Check for regressions.** Make sure the full suite passed, not just the new tests, and that no test was skipped or deleted to get green.
4. **Check the diff hygiene**: no debug prints, commented-out code, stray TODOs, secrets or unrelated files.
5. **Check coverage of the change.** New or changed lines should be covered. Any drop in coverage needs a reason.
6. **Write** `specs/<id>-<slug>/qa-report.md`. For trivial tasks, put it inline in your reply.

## Report

```markdown
# QA report <id>
Verdict: PASS | FAIL

| Gate | Command | Result |
| --- | --- | --- |
| lint | <cmd> | pass |
| tests | <cmd> | pass (212 passed, 0 skipped) |

| Criterion | Test case | Test | Result |
| --- | --- | --- | --- |
| AC1 | TC1 | tests/api/test_users.py::test_get_user | pass |

Defects found: none | <id, repro, severity>
Not verified: <anything you couldn't check, and why>
```

FAIL if any gate fails, any criterion lacks passing evidence, or tests were skipped or deleted without a reason.
