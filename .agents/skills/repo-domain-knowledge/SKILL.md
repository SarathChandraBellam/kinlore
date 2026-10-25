---
name: repo-domain-knowledge
description: This project's domain and system knowledge - glossary of business terms, core entities and rules, architecture map, integrations, data flows and known gotchas. Use when a task mentions business terms, touches core entities or integrations, or when exploring the codebase for the first time.
metadata:
  type: repo
  kind: knowledge
---
# Domain and system knowledge

What a new teammate needs to know beyond the code. Agents add facts as they discover them (with a source), and a human confirms.
Keep each section short. Move large material to `references/` and link to it.

## Glossary
| Term | Meaning in this project | Not to be confused with |
| --- | --- | --- |
| _TBD_ | _TBD_ | _TBD_ |

## Core entities and business rules
- _e.g. An `Order` is immutable after `submitted`; refunds create a new `Adjustment`._

## Architecture map
| Component | Path | Responsibility | Talks to |
| --- | --- | --- | --- |
| _TBD_ | _TBD_ | _TBD_ | _TBD_ |

## Integrations
| System | Purpose | How we call it | Env vars (names only) | Test double |
| --- | --- | --- | --- | --- |
| _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |

## Data flows
- _e.g. Webhook → queue → worker → DB; retries x3 with backoff._

## Gotchas
- _e.g. Timestamps from the billing API are local time, not UTC._

## How agents use this
- **Explorer and planner:** read this first. Use the glossary's terms in specs.
- **Developer and qa-engineer:** respect the business rules and use the listed test doubles for integrations.
- **Anyone:** when you learn a non-obvious fact, propose an addition with its source (`file:line`, a doc or a person).
