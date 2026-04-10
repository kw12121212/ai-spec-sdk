# Questions: java-cli-demo

## Open

<!-- All questions resolved — ready for implementation -->

## Resolved

- [x] Q: Should the Java CLI use any external JSON-RPC library or stick to Jackson-only for JSON parsing?
  Context: The Go example uses only standard library. Java's standard JSON is weak. Using a JSON-RPC library would simplify implementation but add dependency.
  A: Use Jackson only (no JSON-RPC library) — accepted recommendation.

- [x] Q: What is the minimum Java version to target?
  Context: Java 8 is widely compatible but lacks modern features. Java 11 or 17 are LTS versions with better language features.
  A: Java 17 — user specified.

- [x] Q: Should the Java CLI include a test suite or is the manual verification in tasks.md sufficient?
  Context: The go-cli example includes Go test files. Java typically uses JUnit for testing.
  A: Include basic JUnit 5 tests for JsonRpcClient and SessionManager — accepted recommendation.
