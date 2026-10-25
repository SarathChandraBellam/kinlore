# specs/

One folder per unit of work, `specs/<id>-<slug>/`, committed with the code so humans and agents keep context across sessions.

| File | Written by | Skill |
| --- | --- | --- |
| `spec.md` | planner | `role-writing-specs` (what and why, with Given/When/Then acceptance criteria) |
| `plan.md` | planner | `role-planning-changes` (how: design notes, tasks, test strategy) |
| `test-cases.md` | qa-engineer | `role-designing-test-cases` (written **before** code) |
| `qa-report.md` | qa-engineer | `role-verifying-changes` (evidence that every gate passed) |

Trivial changes don't need a folder.
