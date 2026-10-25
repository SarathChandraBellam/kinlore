---
name: repo-project-intent
description: This project's intent - why it exists, who it serves, goals and non-goals, guiding principles, constraints and key decisions. Use before planning or reviewing any change, when weighing trade-offs, or when a request may conflict with the project's direction.
metadata:
  type: repo
  kind: intent
---
# Project intent

The "why" behind every decision. The planner reads this before writing a spec, and the reviewer checks changes against it.
**Keep it short and current.** Agents propose edits; a human approves them.

## Purpose
<!-- One paragraph: the problem this project solves and for whom. -->
_TBD_

## Users and their jobs
| User | What they need to get done |
| --- | --- |
| _TBD_ | _TBD_ |

## Goals (this quarter / release)
- _TBD_

## Non-goals
- _TBD (things we deliberately won't do, so agents don't add them)_

## Principles (rank-ordered: when they conflict, the higher one wins)
1. _e.g. Correctness over speed of delivery_
2. _e.g. Simple, boring tech over novel tech_
3. _e.g. Backwards compatibility for the public API_

## Constraints
- _e.g. Must run on-prem; no external SaaS calls; data stays in region X; p95 < 300 ms_

## Decisions log
| Date | Decision | Why | Alternatives rejected |
| --- | --- | --- | --- |
| _TBD_ | _TBD_ | _TBD_ | _TBD_ |

## How agents use this
- **Planner:** flag any request that conflicts with a non-goal, principle or constraint before planning it.
- **Reviewer:** a change that violates a principle or constraint is a **major** finding.
- **Anyone:** when a new decision is made in a conversation, propose a row for the decisions log.
