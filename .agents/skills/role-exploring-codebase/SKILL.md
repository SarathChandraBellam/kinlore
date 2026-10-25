---
name: role-exploring-codebase
description: Maps the parts of a codebase relevant to a question (entry points, call flow, data model, tests, conventions) without editing anything, and returns file:line evidence. Use before planning or changing unfamiliar code, or when asked "where is", "how does", or "what uses".
metadata:
  type: role
  role: role-explorer
---
# Exploring the codebase

1. **Start from the question.** Write down exactly what you need to know. Read `repo-domain-knowledge` first for the glossary and architecture map.
2. **Search wide, then read narrow.** Grep for symbols, routes, config keys and error strings, then read only the files that matter.
3. **Read the tests early.** They document the real behaviour and edge cases.
4. **Follow one flow end to end**: entry point → logic → data → output.
5. **Note the conventions**: naming, error handling, layering, and how similar features were built (the pattern to copy).
6. **Stop when the question is answered.** Exploration is cheap per step but expensive in total.

## Output (keep under about 40 lines)

```markdown
Answer: <2–4 sentences>
Evidence:
- src/api/users.py:42: route handler for GET /users/{id}
- tests/api/test_users.py:10: covers happy path only
Pattern to reuse: <file/feature>
Unknowns: <what you couldn't determine>
```
