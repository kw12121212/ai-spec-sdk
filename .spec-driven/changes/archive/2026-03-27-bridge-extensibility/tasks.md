# Tasks: bridge-extensibility

## Implementation

- [x] Create `src/mcp-store.ts` — MCP server registry with process lifecycle, workspace-scoped, disk persistence under workspace `.claude/mcp/`
- [x] Create `src/config-store.ts` — Configuration store with project/user scope resolution, known-key validation, passthrough for unknown keys
- [x] Create `src/hooks-store.ts` — Hook registry with event pattern matching, blocking semantics for `pre_tool_use`, persistence in settings
- [x] Add MCP methods to `src/bridge.ts` dispatch: `mcp.add`, `mcp.remove`, `mcp.start`, `mcp.stop`, `mcp.list`
- [x] Add Config methods to `src/bridge.ts` dispatch: `config.get`, `config.set`, `config.list`
- [x] Add Hooks methods to `src/bridge.ts` dispatch: `hooks.list`, `hooks.add`, `hooks.remove`
- [x] Add MCP notifications: `mcp/server_started`, `mcp/server_stopped`, `mcp/server_error`
- [x] Add Hook notification: `bridge/hook_triggered` with event type, hook ID, and session context
- [x] Wire hook execution into session lifecycle: fire `pre_tool_use` before tool approval, `post_tool_use` after tool result, `notification` on session events, `stop` on session stop, `subagent_stop` on subagent completion
- [x] Update `src/capabilities.ts` to include all new methods in capability discovery
- [x] Re-export new types from `src/index.ts`
- [x] Update Go CLI example under `example/go-cli/` to demonstrate `mcp.add`/`mcp.list` and `config.get`/`config.set`

## Testing

- [x] Create `test/mcp-store.test.ts` — workspace scoping, add/remove/start/stop, auto-start on add, list with status, persistence
- [x] Create `test/config-store.test.ts` — scope resolution (project overrides user), get/set/list, known-key validation, passthrough for unknown keys, persistence
- [x] Create `test/hooks-store.test.ts` — add/remove/list, event matching, workspace scope, blocking hooks for pre_tool_use, persistence
- [x] Lint passes (`bun run lint`)
- [x] All tests pass (`bun test`)

## Verification

- [x] Verify all new methods return correct JSON-RPC 2.0 responses
- [x] Verify MCP servers are workspace-scoped and persisted under `.claude/mcp/`
- [x] Verify config scope resolution: project values override user values
- [x] Verify hooks fire at correct lifecycle points during sessions
- [x] Verify `bridge.capabilities` advertises all new methods
- [x] Verify Go CLI example builds and demonstrates MCP and config methods
- [x] Verify no existing tests are broken
