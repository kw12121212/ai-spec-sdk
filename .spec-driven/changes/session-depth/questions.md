# Questions: session-depth

## Open

<!-- No open questions -->

## Resolved

- [x] Q: Should tool approval flow be in scope for this change?
  Context: GUI might want to show approve/deny dialogs for tool calls.
  A: No — tool approval is low priority and out of scope for this change.

- [x] Q: Should persistence be optional or always-on?
  Context: In-memory-only mode is simpler for testing and embedded use cases.
  A: Persistence is opt-in via `sessionsDir` constructor option; when absent, behavior is unchanged (in-memory only). The CLI always provides the default path.

- [x] Q: Single store file vs one file per session?
  Context: Affects read/write patterns and recoverability.
  A: One file per session — simpler, independently readable and deletable, no migration needed.
