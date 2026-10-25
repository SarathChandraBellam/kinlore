---
name: repo-review-rules
description: This project's own review checklist - rules specific to this codebase that generic review misses (architecture boundaries, banned patterns, required patterns, performance budgets, compliance). Use together with role-reviewing-code whenever reviewing a diff or PR in this repo.
metadata:
  type: repo
  kind: review
---
# Project review rules

`role-reviewing-code` covers generic quality. This skill holds the rules **only this project** has. Every rule needs a reason,
so reviewers apply it with judgment rather than blindly.

## Architecture boundaries
| Rule | Why | Severity if broken |
| --- | --- | --- |
| _e.g. `domain/` never imports from `api/` or `db/`_ | _keeps business logic testable_ | major |

## Required patterns
- _e.g. All DB access goes through repositories in `src/db/repos/`._
- _e.g. Every new endpoint has an auth dependency and a contract test._

## Banned patterns
- _e.g. No raw SQL string formatting. Use parameters._
- _e.g. No `print`. Use the project logger._

## Budgets and non-functional rules
- _e.g. No new dependency over 1 MB without approval. Endpoint p95 must stay under 300 ms on the bench._

## Compliance and data
- _e.g. PII fields (`email`, `phone`) are never logged and are masked in errors._

## How agents use this
- **code-reviewer and security-reviewer:** apply every rule here after the generic checklist, and cite the rule in each finding.
- **Anyone:** when the same review comment appears twice, propose it as a new rule here.
