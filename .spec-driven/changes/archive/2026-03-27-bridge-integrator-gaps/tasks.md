# Tasks: bridge-integrator-gaps

## Implementation

- [x] Add `messageType` classification to `agent_message` notifications in `BridgeServer._runQuery` (map SDK message shapes to `system_init` / `assistant_text` / `tool_use` / `tool_result` / `result` / `other`)
- [x] Add `session.list` case to `BridgeServer.dispatch`
- [x] Implement `SessionStore.list(filter?: "active" | "all")` returning up to 100 most recent sessions sorted by `createdAt` descending
- [x] Add and validate first-class agent control parameters (`model`, `allowedTools`, `disallowedTools`, `permissionMode`, `maxTurns`, `systemPrompt`) in `BridgeServer.startSession` and `BridgeServer.resumeSession`
- [x] Apply `permissionMode` default of `"bypassPermissions"` when not supplied by the caller
- [x] Merge validated control parameters into `sdkOptions` passed to `runClaudeQuery`

## Testing

- [x] Test: `agent_message` notifications carry correct `messageType` for each defined shape (system_init, assistant_text, tool_use, tool_result, result, other)
- [x] Test: `session.list` with no filter returns all sessions up to 100, sorted by `createdAt` descending
- [x] Test: `session.list` with `status: "active"` returns only active sessions
- [x] Test: `session.list` with `status: "all"` returns all sessions
- [x] Test: `session.list` with unknown `status` value returns `-32602`
- [x] Test: `session.list` caps response at 100 entries when more exist
- [x] Test: `session.start` with valid `model` passes it to the agent query
- [x] Test: `session.start` with valid `allowedTools` passes it to the agent query
- [x] Test: `session.start` with valid `disallowedTools` passes it to the agent query
- [x] Test: `session.start` with `permissionMode: "acceptEdits"` passes it to the agent query
- [x] Test: `session.start` without `permissionMode` defaults to `"bypassPermissions"`
- [x] Test: `session.start` with valid `maxTurns` passes it to the agent query
- [x] Test: `session.start` with valid `systemPrompt` passes it to the agent query
- [x] Test: `session.start` with `permissionMode: "superuser"` returns `-32602`
- [x] Test: `session.start` with `maxTurns: "five"` returns `-32602`
- [x] Test: `session.start` with `allowedTools: "Read"` (string not array) returns `-32602`
- [x] Test: control parameters apply on `session.resume` with the same validation rules
- [x] Lint passes (`bun run lint` or equivalent)
- [x] Unit tests pass (`bun test`)

## Verification

- [x] All `bridge/session_event` notifications include `type` and `sessionId` fields
- [x] `agent_message` notifications include `messageType` field
- [x] `session.list` method is present in `bridge.capabilities` response
- [x] Agent control parameters are documented in capability metadata or are otherwise discoverable via `bridge.capabilities`
- [x] Verify implementation matches proposal scope — no out-of-scope features added
