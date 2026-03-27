# bridge-extensibility

## What

Extend the bridge protocol with three core extensibility mechanisms: MCP server management (workspace-scoped lifecycle), configuration/settings management (read/write with scope awareness), and a hooks system (event-driven automation with dedicated methods). These are the three highest-impact gaps between the current SDK and a complete Claude Code CLI integration surface.

## Why

External tools building on this SDK cannot currently configure MCP servers, manage settings, or set up automation hooks — all of which are essential capabilities in Claude Code. Without these, consumers are limited to basic session management and cannot replicate the full CLI experience. These three features together cover the core extensibility story:

- **MCP servers** let tools extend Claude's capabilities with custom tools and data sources
- **Configuration management** lets tools read and persist user preferences, permissions, and environment settings
- **Hooks** let tools automate workflows around tool use, session lifecycle, and notifications

## Scope

**In scope:**
- MCP server lifecycle: `mcp.add`, `mcp.remove`, `mcp.start`, `mcp.stop`, `mcp.list` — workspace-scoped
- MCP auto-start: servers start automatically when added via `mcp.add`
- MCP notifications: `mcp/server_started`, `mcp/server_stopped`, `mcp/server_error`
- Configuration: `config.get`, `config.set`, `config.list` — with project vs user scope
- Config validation: known keys validated, unknown keys allowed as passthrough
- Hooks: `hooks.list`, `hooks.add`, `hooks.remove` — dedicated methods
- Hook events: `pre_tool_use`, `post_tool_use`, `notification`, `stop`, `subagent_stop`
- Hook notification: `bridge/hook_triggered` fired when a hook executes
- `bridge.capabilities` updated to advertise new methods
- Tests for all new methods and notifications
- Go CLI example updated to demonstrate MCP and config management

**Out of scope:**
- Context/CLAUDE.md management (separate change: `bridge-session-ux`)
- Session branching, search, export (separate change: `bridge-session-ux`)
- File change tracking (separate change: `bridge-session-ux`)
- MCP tool result proxying (consumers use agent sessions for tool access)
- MCP server process health monitoring beyond error notification
- Hook output capture or return value processing

## Unchanged Behavior

- Existing JSON-RPC 2.0 protocol structure and error codes remain unchanged
- All existing bridge methods (`session.start`, `session.resume`, `session.stop`, `session.list`, `session.history`, `session.events`, `bridge.capabilities`, `bridge.ping`, `models.list`, `tools.list`, `workspace.register`, `workspace.list`, `workflow.run`, `skills.list`, `session.approveTool`, `session.rejectTool`) continue to work identically
- Session persistence format and location are unchanged
- Agent control parameters (`model`, `allowedTools`, `disallowedTools`, `permissionMode`, `maxTurns`, `systemPrompt`) are unchanged
- Tool approval flow is unchanged
- Event buffer behavior (in-memory, 500 cap, sequence numbers) is unchanged
- Native build output is unchanged
