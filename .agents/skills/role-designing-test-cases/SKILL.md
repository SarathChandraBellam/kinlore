---
name: role-designing-test-cases
description: Designs test cases from acceptance criteria before code is written, covering positive, negative, boundary, state and error cases at the right test level (unit, integration, contract, e2e). Use after the spec and plan exist, or when asked for a test plan, test cases, QA scenarios or coverage of requirements.
metadata:
  type: role
  role: role-qa-engineer
  phase: inception
---
# Designing test cases (shift-left QA)

Test cases are written **before the code**, so the developer builds against them and nobody discovers what "done" means at
the end. Save them as `specs/<id>-<slug>/test-cases.md`.

## Steps

1. **Check testability.** For each criterion, ask whether you can observe pass or fail. If not, send it back to the planner.
2. **Derive cases** using the techniques in [references/techniques.md](references/techniques.md):
   - equivalence partitions and **boundary values** for inputs,
   - **negative cases**: invalid, missing, malformed, unauthorised,
   - **state transitions** for anything with a lifecycle,
   - **error and resilience cases**: timeouts, retries, dependency failures,
   - **regression**: existing behaviour that must not change.
3. **Choose the level** for each case, using the lowest one that gives confidence:
   - **unit**: pure logic, many cases, milliseconds.
   - **integration**: real database or file system or framework wiring. Fewer cases.
   - **contract**: API or schema boundaries between services and clients.
   - **e2e**: a handful of critical user journeys only.
4. **Prioritise**: P1 must be automated before merge, P2 should be, P3 is nice to have.
5. **Trace** every case to a criterion. Every criterion has at least one P1 case.

## Template

```markdown
# Test cases <id>

| ID | Criterion | Level | Priority | Given | When | Then |
| --- | --- | --- | --- | --- | --- | --- |
| TC1 | AC1 | unit | P1 | user 7 exists | GET /users/7 | 200 + body.id == 7 |
| TC2 | AC2 | unit | P1 | — | GET /users/abc | 400 "id must be numeric" |
| TC3 | AC2 | unit | P2 | — | GET /users/0 and /users/-1 | 400 |
| TC4 | AC3 | integration | P1 | db has no user 999 | GET /users/999 | 404 |

Untestable or unclear criteria: none
Regression scope: existing GET /users list endpoint
```
