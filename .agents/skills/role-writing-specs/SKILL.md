---
name: role-writing-specs
description: Writes a feature or bug spec with problem, scope, non-goals and testable Given/When/Then acceptance criteria, plus open questions. Use at the start of any non-trivial change, or when asked for requirements, user stories, acceptance criteria or a spec.
metadata:
  type: role
  role: role-planner
  phase: inception
---
# Writing specs

A spec says **what** and **why**, never **how**. Start from [assets/spec-template.md](assets/spec-template.md) and save the result
as `specs/<id>-<slug>/spec.md`. For `<id>`, use the next free number, or the issue number if there is one.

## Steps

0. **Load project context.** Read `repo-project-intent` (goals, non-goals, principles, constraints) and `repo-domain-knowledge`
   (glossary, business rules). Flag any conflict with a non-goal or constraint, and use the glossary's terms.
1. **Elaborate before writing.** List your assumptions and questions. Ask the human the ones that would change the
   scope or behaviour, one at a time and with options. Don't invent business rules.
2. **Write the problem and goal** in two or three sentences each.
3. **Set the scope.** Name what's in and what's out (the non-goals). Non-goals prevent scope creep.
4. **Write the acceptance criteria** as Given/When/Then, numbered AC1, AC2, ... Each one must be:
   - **observable**: a status code, a UI state, a file or a log line. "Is fast" doesn't count; "p95 < 200 ms on the bench" does.
   - **independent**: testable on its own.
   - **complete**: include the unhappy paths (invalid input, unauthorised user, not found, timeout).
5. **Add non-functional criteria** only when they matter: performance, security, accessibility, compatibility.
6. **For a bug**, write the actual behaviour, the expected behaviour and the reproduction steps. The fix's criterion is "the
   reproduction no longer fails, and a regression test exists".

## Smells

- A criterion that names a function or table. That's implementation, so move it to the plan.
- "Should handle errors gracefully". Say *which* error and *what* happens.
- More than about 10 criteria. Split the spec into units.
