## ADDED Requirements

### Requirement: MCP Server Management Methods
The bridge MUST expose the following methods for managing MCP server instances, scoped per workspace:

- `mcp.add` — Register and auto-start an MCP server for a workspace
- `mcp.remove` — Stop and remove an MCP server
- `mcp.start` — Start a stopped MCP server
- `mcp.stop` — Stop a running MCP server without removing its configuration
- `mcp.list` — List MCP servers for a workspace with their status

#### Scenario: Add an MCP server to a workspace
- GIVEN a client calls `mcp.add` with `{ workspace: "/path/to/project", name: "my-server", command: "node", args: ["server.js"], env: { "API_KEY": "..." } }`
- WHEN the bridge processes the request
- THEN the server configuration is persisted under the workspace's `.claude/mcp/` directory, the server process is started, and the response includes `{ name, status: "running", pid }`

#### Scenario: Remove an MCP server
- GIVEN an MCP server is configured and running for a workspace
- WHEN a client calls `mcp.remove` with `{ workspace: "/path/to/project", name: "my-server" }`
- THEN the server process is stopped, its configuration is deleted, and the response confirms removal

#### Scenario: Stop a running MCP server
- GIVEN an MCP server is running for a workspace
- WHEN a client calls `mcp.stop` with `{ workspace: "/path/to/project", name: "my-server" }`
- THEN the server process is terminated and the response includes `{ name, status: "stopped" }`

#### Scenario: Start a stopped MCP server
- GIVEN an MCP server is configured but stopped for a workspace
- WHEN a client calls `mcp.start` with `{ workspace: "/path/to/project", name: "my-server" }`
- THEN the server process is started and the response includes `{ name, status: "running", pid }`

#### Scenario: List MCP servers for a workspace
- GIVEN multiple MCP servers are configured for a workspace
- WHEN a client calls `mcp.list` with `{ workspace: "/path/to/project" }`
- THEN the response includes a `servers` array where each entry has `name`, `status` (`"running"` | `"stopped"` | `"error"`), and optional `pid`

#### Scenario: MCP server name is unique per workspace
- GIVEN an MCP server named "my-server" already exists for a workspace
- WHEN a client calls `mcp.add` with the same workspace and name
- THEN the bridge returns a `-32602` error indicating the server name already exists

#### Scenario: Unknown workspace returns error
- GIVEN a client calls `mcp.add` with a workspace path that does not exist
- WHEN the bridge validates the request
- THEN the bridge returns a `-32001` error indicating the workspace directory does not exist

### Requirement: MCP Server Notifications
The bridge MUST emit the following notifications for MCP server lifecycle events:

| Notification | Required fields |
|---|---|
| `mcp/server_started` | `workspace`, `name`, `pid` |
| `mcp/server_stopped` | `workspace`, `name`, `exitCode` |
| `mcp/server_error` | `workspace`, `name`, `error` |

#### Scenario: Server started notification
- GIVEN an MCP server is started (via `mcp.add` or `mcp.start`)
- WHEN the server process begins running
- THEN the bridge emits an `mcp/server_started` notification

#### Scenario: Server stopped notification
- GIVEN an MCP server process exits
- WHEN the bridge detects the process exit
- THEN the bridge emits an `mcp/server_stopped` notification with the exit code

#### Scenario: Server error notification
- GIVEN an MCP server process encounters an error
- WHEN the bridge detects the error
- THEN the bridge emits an `mcp/server_error` notification with the error message

### Requirement: MCP Server Capability Advertisement
The `bridge.capabilities` response MUST include `mcp.add`, `mcp.remove`, `mcp.start`, `mcp.stop`, and `mcp.list` in its supported methods list.

### Requirement: Config Management Methods
The bridge MUST expose the following methods for reading and writing configuration:

- `config.get` — Read one or all configuration values
- `config.set` — Write a configuration value
- `config.list` — List all configuration keys and their values

Configuration has two scopes: `project` (stored in `<workspace>/.claude/settings.json`) and `user` (stored in `~/.claude/settings.json`). Project-level values override user-level values when both exist.

#### Scenario: Get a specific config value
- GIVEN a configuration key `"preferredModel"` is set at the user scope
- WHEN a client calls `config.get` with `{ key: "preferredModel" }`
- THEN the response includes `{ key: "preferredModel", value: "<the value>", scope: "user" }`

#### Scenario: Get merged config without scope
- GIVEN `"preferredModel"` is set to `"opus"` at user scope and `"sonnet"` at project scope for workspace `/proj`
- WHEN a client calls `config.get` with `{ key: "preferredModel", workspace: "/proj" }`
- THEN the response returns `{ key: "preferredModel", value: "sonnet", scope: "project" }` (project overrides user)

#### Scenario: Set a project-scoped config value
- GIVEN a client wants to set a project-level preference
- WHEN the client calls `config.set` with `{ workspace: "/proj", key: "preferredModel", value: "sonnet", scope: "project" }`
- THEN the value is written to `/proj/.claude/settings.json` and the response confirms the write

#### Scenario: Set a user-scoped config value
- GIVEN a client wants to set a global preference
- WHEN the client calls `config.set` with `{ key: "preferredModel", value: "opus", scope: "user" }`
- THEN the value is written to `~/.claude/settings.json` and the response confirms the write

#### Scenario: List all config
- GIVEN configuration values exist at both user and project scope
- WHEN a client calls `config.list` with `{ workspace: "/proj" }`
- THEN the response includes a `settings` array showing each key with its resolved value, user value, and project value (if set)

#### Scenario: Config validation for known keys
- GIVEN a client calls `config.set` with a known key `"permissionMode"` and an invalid value `"superuser"`
- WHEN the bridge validates the request
- THEN the bridge returns a `-32602` error indicating the value is invalid for that key

#### Scenario: Unknown config keys are allowed
- GIVEN a client calls `config.set` with key `"customPlugin.mySetting"` and value `"enabled"`
- WHEN the bridge processes the request
- THEN the value is stored without validation error (passthrough)

### Requirement: Config Capability Advertisement
The `bridge.capabilities` response MUST include `config.get`, `config.set`, and `config.list` in its supported methods list.

### Requirement: Hooks Management Methods
The bridge MUST expose the following methods for managing automation hooks:

- `hooks.add` — Register a new hook
- `hooks.remove` — Remove a hook by ID
- `hooks.list` — List configured hooks

A hook is defined by: `event` (the trigger event type), `command` (shell command to execute), `matcher` (optional tool name pattern), and `scope` (project or user).

Defined hook events:

| Event | Blocking | Description |
|---|---|---|
| `pre_tool_use` | Yes | Fires before a tool is executed; agent waits for completion |
| `post_tool_use` | No | Fires after a tool produces a result |
| `notification` | No | Fires when a session notification is emitted |
| `stop` | No | Fires when a session stops |
| `subagent_stop` | No | Fires when a subagent session stops |

#### Scenario: Add a pre_tool_use hook
- GIVEN a client calls `hooks.add` with `{ event: "pre_tool_use", command: "validate.sh", matcher: "Bash", scope: "project", workspace: "/proj" }`
- WHEN the bridge processes the request
- THEN the hook is persisted and the response includes `{ hookId: "<id>", event: "pre_tool_use", command: "validate.sh", matcher: "Bash" }`

#### Scenario: Add a hook without matcher
- GIVEN a client calls `hooks.add` with `{ event: "stop", command: "cleanup.sh", scope: "user" }`
- WHEN the bridge processes the request
- THEN the hook fires on every `stop` event regardless of tool name

#### Scenario: Remove a hook
- GIVEN a hook with ID `"hook-123"` exists
- WHEN a client calls `hooks.remove` with `{ hookId: "hook-123" }`
- THEN the hook is deleted and the response confirms removal

#### Scenario: List hooks for a workspace
- GIVEN hooks exist at both user and project scope for a workspace
- WHEN a client calls `hooks.list` with `{ workspace: "/proj" }`
- THEN the response includes a `hooks` array with all hooks (user-scoped and project-scoped), each including `hookId`, `event`, `command`, `matcher`, and `scope`

#### Scenario: List hooks without workspace
- GIVEN only user-scoped hooks exist
- WHEN a client calls `hooks.list` without a workspace parameter
- THEN the response includes only user-scoped hooks

#### Scenario: Invalid hook event is rejected
- GIVEN a client calls `hooks.add` with `{ event: "invalid_event", command: "test.sh" }`
- WHEN the bridge validates the request
- THEN the bridge returns a `-32602` error indicating the event type is invalid

### Requirement: Hook Execution Notification
When a hook fires during session execution, the bridge MUST emit a `bridge/hook_triggered` notification containing: `sessionId`, `hookId`, `event`, `command`, and `matcher` (if present).

#### Scenario: Hook fires during tool use
- GIVEN a `pre_tool_use` hook is configured for the `Bash` tool
- WHEN an agent session attempts to use the `Bash` tool
- THEN the bridge emits a `bridge/hook_triggered` notification before the tool executes and waits for the hook command to complete

#### Scenario: Non-blocking hook fires and continues
- GIVEN a `post_tool_use` hook is configured
- WHEN a tool produces a result
- THEN the bridge emits a `bridge/hook_triggered` notification and continues without waiting

### Requirement: Hooks Capability Advertisement
The `bridge.capabilities` response MUST include `hooks.add`, `hooks.remove`, and `hooks.list` in its supported methods list, and MUST list the supported hook events.
