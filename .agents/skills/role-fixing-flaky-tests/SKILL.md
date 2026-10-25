---
name: role-fixing-flaky-tests
description: Diagnoses and fixes tests that pass and fail without code changes (timing, order dependence, shared state, randomness, time zones, network). Use when a test is intermittent, fails only in CI, or fails only when run with others.
metadata:
  type: role
  role: role-qa-engineer
---
# Fixing flaky tests

Never "fix" a flaky test with retries, longer sleeps, or by deleting it.

1. **Reproduce.** Run the test in a loop (for example 50 times), in isolation and with the full suite, and in random order if the
   runner supports it. Note the failure rate.
2. **Classify the cause:**
   - **timing**: sleeps, async work not awaited, polling without a condition.
   - **order or shared state**: global variables, a shared database, files or env vars left behind by another test.
   - **randomness**: unseeded random values or unordered collections compared as ordered.
   - **time**: `now()`, time zones, DST, end-of-month dates.
   - **environment**: real network, ports, CPU speed, locale.
3. **Fix the cause:**
   - await or wait on a condition,
   - isolate state with fixtures and teardown,
   - seed randomness, freeze the clock,
   - mock the network at the boundary,
   - sort collections before comparing.
4. **Prove the fix.** The loop from step 1 now passes 50 out of 50.
5. **Report** the cause class, the fix, and whether other tests share the same pattern.
