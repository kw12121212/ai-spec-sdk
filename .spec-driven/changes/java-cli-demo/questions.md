# Questions: java-cli-demo

## Open

- [ ] Q: Should the Java CLI use any external JSON-RPC library or stick to Jackson-only for JSON parsing?
  Context: The Go example uses only standard library. Java's standard JSON is weak. Using a JSON-RPC library would simplify implementation but add dependency.
  Recommendation: Use Jackson only (no JSON-RPC library) — Jackson handles JSON well, and implementing the JSON-RPC protocol manually is straightforward and keeps dependencies minimal.

- [ ] Q: What is the minimum Java version to target?
  Context: Java 8 is widely compatible but lacks modern features. Java 11 or 17 are LTS versions with better language features.
  Recommendation: Java 11 as minimum — it's an LTS release with good adoption and modern enough features (var, improved Optional).

- [ ] Q: Should the Java CLI include a test suite or is the manual verification in tasks.md sufficient?
  Context: The go-cli example includes Go test files. Java typically uses JUnit for testing.
  Recommendation: Include basic JUnit tests for JsonRpcClient and SessionManager to match go-cli's test coverage, but keep them minimal since this is a demo.

## Resolved

<!-- Resolved questions are moved here with their answers -->
