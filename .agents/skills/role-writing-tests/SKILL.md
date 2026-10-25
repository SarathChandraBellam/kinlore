---
name: role-writing-tests
description: Implements automated tests from designed test cases or acceptance criteria, deterministic and following repo conventions, and proves they fail without the change. Use when adding or fixing tests, writing a regression test, or automating test cases.
metadata:
  type: role
  role: role-qa-engineer
  phase: construction
---
# Writing tests

1. **Follow the house style.** Match the existing tests' layout, naming and fixtures, and the `stack-<tech>` skill if one exists.
2. **One behaviour per test**, named after the behaviour (`test_non_numeric_id_returns_400`). Reference the case ID in a comment
   (`# TC2 / AC2`).
3. **Arrange, act, assert** with minimal setup. Keep shared setup in fixtures, not copy-paste.
4. **Use real objects. Mock only at boundaries**: network, clock, randomness, third-party APIs. Over-mocking tests the mocks.
5. **Keep tests deterministic**: no sleeps, no real network, no order dependence, seeded randomness, frozen time, isolated data.
6. **Assert the behaviour, not the implementation.** Check the outputs and visible side effects, not private calls.
7. **Prove each test bites.** Confirm it fails without the change: write it first, or temporarily revert the change.
8. **Keep it fast.** Unit tests run in milliseconds. Mark slow tests so they can be run separately.
9. Run the test command from `AGENTS.md`, then the full check.

Anti-patterns: assertions in loops without messages, catch-all `try/except`, huge snapshots, tests that pass when the code is deleted,
tests that depend on today's date.
