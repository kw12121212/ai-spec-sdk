# Questions: python-client-sdk

## Open

<!-- No open questions -->

## Resolved

- [x] Q: Should we use the official `claude-agent-sdk` Python package or build our own subprocess management?
  Context: The official SDK handles CLI subprocess lifecycle and message protocol.
  A: Use `claude-agent-sdk` as the foundation for stdio transport (user confirmed).

- [x] Q: Should we provide both sync and async APIs?
  Context: `claude-agent-sdk` is async-only; sync would require event loop threading.
  A: Async only — matches `claude-agent-sdk` and avoids complexity.

- [x] Q: Should `claude-agent-sdk` be a required dependency or an optional extra?
  Context: If required, all users get it even if they only use HTTP mode. If optional, stdio users must remember the extra.
  A: Required — stdio is the default and primary value proposition.

- [x] Q: Should method names use snake_case or camelCase?
  Context: TS Client SDK uses camelCase (`sessionStart`). Python convention is snake_case.
  A: camelCase — match the TS Client SDK for API consistency across languages.

- [x] Q: For stdio transport, should `sessionStart` block until completion or return immediately with event streaming?
  Context: `claude-agent-sdk` supports both patterns. The bridge returns sessionId immediately.
  A: Return immediately with sessionId, stream events via `on("session_event", handler)`. Matches bridge behavior, non-blocking, supports concurrent sessions.
