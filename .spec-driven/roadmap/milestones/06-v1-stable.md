# v1 Stable

## Goal
Establish the first stable API guarantee by auto-generating SDK types from the bridge contract and delivering the JVM reference implementation.

## In Scope
- Type generation tooling: bridge-contract.yaml → TypeScript and Python type stubs, replacing hand-written type files
- Java CLI REPL reference implementation matching go-cli feature parity

## Out of Scope
- gRPC transport (long-term candidate, not in v1 scope)
- Auto-update mechanism for published binaries
- Kotlin/Scala CLI variants
- Gradle build for java-cli-demo (Maven only)

## Done Criteria
- TypeScript and Python client types are generated from bridge-contract.yaml; manual type files removed
- Java CLI compiles with Maven 3+ and connects to bridge subprocess via stdio
- All milestones 01–05 are complete

## Planned Changes
- `contract-type-generation` - Declared: complete - auto-generate TypeScript and Python types from bridge-contract.yaml
- `java-cli-demo` - Declared: planned - Java CLI REPL reference implementation

## Dependencies
- 03-platform-reach — stable published artifacts needed before java-cli-demo
- 05-developer-ecosystem — all integration features complete before issuing v1 API guarantee

## Risks
- Type generation requires bridge-contract.yaml to remain machine-parseable; any informal annotations must be migrated first.
- java-cli-demo is P2 and can slip to a post-v1 release without blocking the stability guarantee.

## Status
- Declared: proposed

## Notes
gRPC transport is a long-term candidate for a future v1.x milestone targeting high-performance server integrations.

