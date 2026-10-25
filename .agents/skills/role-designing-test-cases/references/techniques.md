# Test design techniques

## Equivalence partitioning
Split each input into classes that behave the same (valid, too small, too large, wrong type, empty) and test one value per class.

## Boundary value analysis
Bugs cluster at edges. For a range `[min, max]`, test `min-1, min, min+1, max-1, max, max+1`. Do the same for lengths, counts and
dates (end of month, leap day, timezone changes).

## Decision tables
When several conditions combine (role × plan × feature flag), list the combinations and the expected outcome of each, then cover
every distinct outcome.

## State transitions
For entities with a lifecycle (draft → submitted → approved), test every valid transition and at least one invalid transition from each state.

## Error guessing and resilience
Test null or empty values, unicode, very large payloads, concurrent updates, duplicate submissions, dependency timeouts and partial failures.

## The test pyramid
Most tests should be fast unit tests, with fewer integration tests and very few e2e tests. Push each case to the lowest level that
can catch the bug. Contract tests protect interfaces between services so that e2e isn't needed for them.

## Properties
For pure functions, consider property-based tests (round-trip, idempotence, invariants) in addition to examples.
