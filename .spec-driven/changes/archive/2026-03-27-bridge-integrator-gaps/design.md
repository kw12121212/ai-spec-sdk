# Design: bridge-integrator-gaps

## Approach

Three parallel additions to the existing bridge, each touching a different layer:

**1. Event schema** — the bridge already emits `bridge/session_event` notifications. No new code path is needed; the spec formalizes the existing emission points into typed contracts. Implementation validates at the emit sites that the correct fields are present.

**2. Agent control parameters** — `session.start` and `session.resume` gain an explicit validation step before building `sdkOptions`. Validated params are merged into the options object passed to `runClaudeQuery`. The existing options passthrough remains for unknown SDK options not covered by this spec.

**3. `session.list`** — new `dispatch` case in `BridgeServer`. `SessionStore` gains a `list(filter)` method that returns the most recent 100 entries sorted by `createdAt` descending. No new storage; all state remains in-memory.

## Key Decisions

- **`permissionMode` default = `bypassPermissions`**: programmatic callers should not be blocked by interactive permission prompts. This matches what callers using raw `options` passthrough were already getting implicitly.
- **`agent_message` sub-types are bridge-level labels**, not raw SDK type strings: the spec maps observable SDK message shapes to stable integrator-facing names (`system_init`, `assistant_text`, `tool_use`, `tool_result`, `result`) so SDK internal naming changes do not break integrator contracts.
- **100-session cap is applied at list time**, not at write time: `SessionStore` continues to hold all sessions; the cap is a response truncation, not a storage eviction policy.
- **`allowedTools` / `disallowedTools` are arrays of strings**: no deeper validation of individual tool names — the bridge passes them through after confirming the array type.

## Alternatives Considered

- **Leave agent control in `options` passthrough**: rejected because it provides no contract, no validation, and no documented defaults. Integrators have no way to know which keys are safe to set.
- **Evict old sessions to enforce the 100 cap**: rejected because in-memory sessions are already transient; losing active session state would be a correctness bug.
- **Use raw SDK message types in the event schema**: rejected because SDK-internal type names are not part of the bridge contract and may change between SDK versions.
