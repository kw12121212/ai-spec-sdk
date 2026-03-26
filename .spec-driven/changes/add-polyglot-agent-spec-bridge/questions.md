# Questions: add-polyglot-agent-spec-bridge

## Open

<!-- No open questions -->

## Resolved

- [x] Q: What is the primary integration shape for the first release?
  Context: This determines whether the proposal centers on a language-specific SDK, CLI wrapper, or language-neutral bridge.
  A: The first release targets a polyglot bridge for external tool integration.

- [x] Q: Which transport should the bridge support first?
  Context: This affects the external contract, lifecycle handling, and deployment assumptions.
  A: The first release uses JSON-RPC 2.0 over stdio.

- [x] Q: Which capabilities are in scope for the first release?
  Context: This determines proposal size and prevents the first change from expanding into a full platform.
  A: The first release includes spec-driven workflow operations plus Claude agent session orchestration, but not HTTP deployment, plugin marketplace features, or multi-tenant platform concerns.
