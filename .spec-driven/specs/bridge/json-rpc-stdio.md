### Requirement: JSON-RPC Stdio Bridge
The SDK MUST expose a local JSON-RPC 2.0 interface over standard input and standard output so external tools can call it as a subprocess.

#### Scenario: Handle a valid bridge request
- GIVEN a client starts the SDK bridge as a local process
- WHEN the client sends a valid JSON-RPC 2.0 request to standard input
- THEN the bridge returns a JSON-RPC 2.0 response on standard output

#### Scenario: Reject an unsupported method
- GIVEN a client sends a JSON-RPC 2.0 request for an unsupported method
- WHEN the bridge validates the request
- THEN the bridge returns a structured JSON-RPC error response that identifies the failure

### Requirement: Capability Discovery
The SDK MUST provide a bridge capability response that tells clients which workflow operations, session features, and streaming behaviors are supported by the current SDK version. The response MUST include a `transport` field whose value is `"stdio"` when running in stdio mode and `"http"` when running in HTTP mode.

The `methods` array MUST advertise every callable JSON-RPC method exposed by the current build. If a method is callable from the same bridge process, it MUST appear in `bridge.capabilities.methods`; conversely, a method listed in `bridge.capabilities.methods` MUST be callable from that process.

#### Scenario: Discover bridge capabilities
- GIVEN a client connects to the bridge without prior version-specific assumptions
- WHEN the client requests bridge capabilities
- THEN the bridge returns machine-readable capability metadata for the current process

#### Scenario: Stdio mode reports transport in capabilities
- GIVEN the bridge is running in stdio mode (default)
- WHEN a client calls `bridge.capabilities`
- THEN the response includes `transport: "stdio"`

#### Scenario: Capabilities include the complete public method surface
- GIVEN a client calls `bridge.capabilities`
- WHEN the bridge returns its capability metadata
- THEN the `methods` array includes `session.export`, `session.delete`, `session.cleanup`, and `bridge.info`

### Requirement: Bridge Runtime Info Method
The bridge MUST expose a `bridge.info` method that returns read-only runtime metadata for the current bridge process.

The response MUST include:
- `bridgeVersion` (string)
- `apiVersion` (string)
- `transport` (`"stdio"` | `"http"`)
- `authMode` (string — `"none"` for stdio or no-auth HTTP, `"bearer"` for HTTP with auth enabled)
- `logLevel` (string)
- `sessionsPath` (string — resolved absolute path to the sessions directory)
- `keysPath` (string — resolved absolute path to the keys file)
- `specDrivenScriptPath` (string — resolved absolute path to the spec-driven.js script)
- `nodeVersion` (string)

When the bridge is running in HTTP mode, the response MUST also include an `http` object with the resolved `port` (number) and `corsOrigins` (string) values. When running in stdio mode, `http` MUST be `null`.

`bridge.info` is descriptive only and MUST NOT modify bridge state.

#### Scenario: bridge.info reports stdio runtime metadata
- GIVEN the bridge is running in stdio mode
- WHEN a client calls `bridge.info`
- THEN the response includes `bridgeVersion`, `apiVersion`, `transport: "stdio"`, `authMode`, `logLevel`, `sessionsPath`, `keysPath`, `specDrivenScriptPath`, and `nodeVersion`
- AND `http` is `null`
- AND the method does not create, delete, or mutate sessions or config

#### Scenario: bridge.info reports HTTP runtime metadata
- GIVEN the bridge is running in HTTP mode
- WHEN a client calls `bridge.info`
- THEN the response includes `transport: "http"`
- AND includes an `http` object with the resolved `port` and `corsOrigins`

### Requirement: Streaming Notifications
The SDK MUST emit machine-readable notifications for long-running workflow and session activity so clients can present progress before a final result is available.

#### Scenario: Stream progress for a long-running request
- GIVEN a client starts a workflow or session operation that does not complete immediately
- WHEN the bridge produces intermediate progress events
- THEN the bridge sends notifications correlated to the originating request or session identifier

### Requirement: Session Event Notification Schema
The bridge MUST emit `bridge/session_event` notifications with a `type` field whose value is one of the defined event types, and MUST include exactly the fields specified for that type. Integrators MUST be able to identify any event solely from its `type` field without inspecting the `message` sub-object.

Defined event types and their required fields:

| `type` | Additional required fields |
|---|---|
| `session_started` | `sessionId` |
| `session_resumed` | `sessionId` |
| `session_completed` | `sessionId`, `result` |
| `session_stopped` | `sessionId`, `status` |
| `agent_message` | `sessionId`, `messageType`, `message` |

#### Scenario: Notification carries the correct type label
- GIVEN a bridge event is emitted during a session lifecycle transition or agent message
- WHEN an integrator reads the `bridge/session_event` notification
- THEN the notification contains a `type` field matching one of the defined type values above

### Requirement: Agent Message Sub-type Contract
The bridge MUST classify each `agent_message` notification with a stable `messageType` label. The label MUST correspond to the observable shape of the SDK-emitted message as follows:

| `messageType` | Observable shape |
|---|---|
| `system_init` | `type === "system"` AND `subtype === "init"` — carries `session_id` and `model` |
| `assistant_text` | `type === "assistant"` with at least one `"text"` content block AND no `"tool_use"` blocks |
| `tool_use` | `type === "assistant"` with at least one `"tool_use"` content block (takes precedence over `"text"` blocks) — carries `name` and `input` |
| `tool_result` | `type === "user"` with at least one content block of type `"tool_result"` |
| `result` | `type === "result"` — carries `subtype` (`"success"` or `"error"`) and `result` |
| `other` | Any message shape not matching the above — forwarded as-is without transformation |

The bridge MUST inspect content blocks from `message.message.content` when the SDK wraps the message in a nested `message` object (standard SDK format), and MUST fall back to `message.content` when the content array is at the top level.

When an assistant message contains both `"tool_use"` and `"text"` content blocks, the bridge MUST classify it as `tool_use`.

#### Scenario: assistant_text event carries text content
- GIVEN the agent emits a message of type `"assistant"` with a text content block and no tool_use blocks
- WHEN the bridge forwards it as an `agent_message` notification
- THEN the notification has `messageType === "assistant_text"` and the `message` field contains the text content block

#### Scenario: tool_use event carries tool name and input
- GIVEN the agent emits a message of type `"assistant"` with a tool_use content block
- WHEN the bridge forwards it as an `agent_message` notification
- THEN the notification has `messageType === "tool_use"` and the `message.content` array contains a block with the tool `name` and `input`

#### Scenario: tool_use takes precedence over text in mixed content
- GIVEN the agent emits a message of type `"assistant"` containing both `"tool_use"` and `"text"` content blocks
- WHEN the bridge classifies the message
- THEN the notification has `messageType === "tool_use"`

#### Scenario: result event marks session outcome
- GIVEN the agent emits a terminal result message
- WHEN the bridge forwards it as an `agent_message` notification
- THEN the notification has `messageType === "result"` and the `message` field includes `subtype` and `result`

#### Scenario: unrecognized message is forwarded as other
- GIVEN the agent emits a message that does not match any defined shape
- WHEN the bridge forwards it as an `agent_message` notification
- THEN the notification has `messageType === "other"` and the full message is forwarded without transformation

### Requirement: Session Listing
The bridge MUST expose a `session.list` method that returns summaries of sessions known to the current bridge process.

#### Scenario: List all sessions
- GIVEN a client calls `session.list` without a `status` filter
- WHEN the bridge processes the request
- THEN the response contains a `sessions` array with up to 100 entries, ordered by `createdAt` descending, each including: `sessionId`, `status`, `workspace`, `createdAt`, `updatedAt`

#### Scenario: Filter by active status
- GIVEN a client calls `session.list` with `{ "status": "active" }`
- WHEN the bridge processes the request
- THEN the response `sessions` array contains only sessions whose `status` is `"active"`, up to 100 entries

#### Scenario: Response is capped at 100 entries
- GIVEN more than 100 sessions exist in the bridge process
- WHEN the client calls `session.list`
- THEN the response contains at most 100 entries (the most recent by `createdAt`)

#### Scenario: Unknown status filter is rejected
- GIVEN a client calls `session.list` with an unrecognized `status` value
- WHEN the bridge validates the request
- THEN the bridge returns a `-32602` error

### Requirement: Session History Method in Capabilities
The bridge capability response MUST advertise `session.history` as a supported method so clients can discover it without trial and error.

#### Scenario: Capabilities include session.history
- GIVEN a client calls `bridge.capabilities`
- WHEN the bridge returns its capability metadata
- THEN the response identifies `session.history` as a supported method

### Requirement: bridge.ping health-check method
The Bridge MUST respond to `bridge.ping` with `{pong: true, ts: <ISO-8601 string>}`.
`bridge.capabilities` methods list MUST include `"bridge.ping"` and `"session.events"`.

#### Scenario: Ping returns pong with timestamp
- GIVEN a client calls `bridge.ping`
- WHEN the bridge processes the request
- THEN the response contains `pong: true` and a `ts` field containing an ISO-8601 timestamp

### Requirement: session.events missed-event replay
The Bridge MUST expose a `session.events` method that returns buffered `bridge/session_event`
notifications for a given session.
Request parameters: `{sessionId: string, since?: number, limit?: number}`.
`since` is a non-negative integer; only events with `seq >= since` are returned (default 0).
`limit` is a positive integer; max events returned (default 50, cap 500).
Response: `{sessionId: string, events: Event[], total: number}` where each event includes
a `seq` field (0-based per-session counter).
If the session is unknown, the Bridge MUST return error code `-32011`.
The event buffer is in-memory only; it is not persisted to disk and is cleared on Bridge restart.
The buffer holds at most 500 events per session; oldest events are dropped when the cap is reached.

#### Scenario: Retrieve buffered events after session start
- GIVEN a session has been started and events have been emitted
- WHEN a client calls `session.events` with the session ID
- THEN the response contains the buffered events each with a `seq` field

#### Scenario: since filter returns only later events
- GIVEN a client knows the seq of the last event it received
- WHEN the client calls `session.events` with `since` set to that seq
- THEN only events with seq >= since are returned

#### Scenario: Unknown session returns error
- GIVEN a client calls `session.events` with an unknown sessionId
- WHEN the bridge processes the request
- THEN the bridge returns a `-32011` error

### Requirement: Model List
The bridge MUST expose a `models.list` method that returns the set of supported Claude model IDs and display names so GUI clients can populate a model selector without hard-coding model identifiers.

#### Scenario: List available models
- GIVEN a GUI client needs to present a model selection UI
- WHEN the client calls `models.list` with no parameters
- THEN the bridge returns a `models` array where each entry has an `id` string and a `displayName` string

### Requirement: Workspace Registry
The bridge MUST expose `workspace.register` and `workspace.list` methods so GUI clients can track recently used workspaces across sessions.

`workspace.register` MUST accept a `workspace` parameter (path string), resolve it to an absolute path, and return an error (code -32001) if the path does not exist as a directory. Registering the same path a second time MUST update its `lastUsedAt` timestamp without creating a duplicate entry.

`workspace.list` MUST return workspaces sorted by `lastUsedAt` descending, capped at 50 entries.

When `BridgeServer` is constructed with a `workspacesDir` option the registry MUST be persisted to disk and survive process restarts. When `workspacesDir` is omitted the registry MAY be in-memory only.

#### Scenario: Register and retrieve a workspace
- GIVEN a user opens a project directory in the GUI
- WHEN the GUI calls `workspace.register` with the project path
- THEN the bridge records the workspace and `workspace.list` includes it sorted by most-recently-used

#### Scenario: Re-registering a workspace updates lastUsedAt
- GIVEN a workspace has already been registered
- WHEN `workspace.register` is called again with the same path
- THEN the entry count does not increase and `lastUsedAt` is updated to the current time

### Requirement: Tool List
The bridge MUST expose a `tools.list` method that returns the names and descriptions of the Claude Code built-in tools so GUI clients can display available tools without embedding this knowledge themselves.

#### Scenario: List available tools
- GIVEN a GUI client wants to display or filter available tools
- WHEN the client calls `tools.list` with no parameters
- THEN the bridge returns a `tools` array where each entry has a `name` string and a `description` string

### Requirement: Tool Approval Mode
When a session is started or resumed with `permissionMode: "approve"`, the bridge MUST intercept every tool-use decision and route it to the caller before execution proceeds.

The bridge MUST emit a `bridge/tool_approval_requested` notification containing:
- `sessionId` (string)
- `requestId` (string, unique per tool call)
- `toolName` (string)
- `input` (object, the tool's input arguments)
- `title` (string, optional — human-readable prompt from the SDK)
- `displayName` (string, optional — short label for the tool action)
- `description` (string, optional — additional context from the SDK)

Agent execution MUST be suspended until the caller responds via `session.approveTool` or `session.rejectTool`.

#### Scenario: Tool call is approved
- GIVEN a session is running with `permissionMode: "approve"` and Claude wants to use a tool
- WHEN the bridge emits `bridge/tool_approval_requested` and the caller calls `session.approveTool`
- THEN the tool executes and the session continues normally

#### Scenario: Tool call is rejected
- GIVEN a session is running with `permissionMode: "approve"` and Claude wants to use a tool
- WHEN the bridge emits `bridge/tool_approval_requested` and the caller calls `session.rejectTool`
- THEN the tool is not executed and Claude receives a denial message

### Requirement: session.approveTool
The bridge MUST expose a `session.approveTool` method.

Parameters: `{ sessionId: string, requestId: string }`.

If `requestId` is not found or `sessionId` does not match the session that owns `requestId`, the bridge MUST return error code `-32020`.

On success the pending tool call is allowed to proceed.

### Requirement: session.rejectTool
The bridge MUST expose a `session.rejectTool` method.

Parameters: `{ sessionId: string, requestId: string, message?: string }`.

Same validation as `session.approveTool`. On success the pending tool call is denied; the optional `message` string is forwarded to the agent as the denial reason.

### Requirement: Approval Cleanup on Stop
When `session.stop` is called while approvals are pending, the bridge MUST automatically deny all pending approvals for that session so the agent is not left suspended indefinitely.

### Requirement: Go CLI Integration Example
The project MUST include a Go CLI example under `example/go-cli/` that demonstrates how to start the bridge as a subprocess and communicate via stdio JSON-RPC. The example MUST cover all bridge methods and serve as a reference for downstream integrators.

#### Scenario: Example builds and runs
- GIVEN the SDK has been built (`bun run build`)
- WHEN a developer runs `go build` inside `example/go-cli/`
- THEN the resulting binary can be executed and connects to the bridge via stdio

#### Scenario: Example demonstrates notification handling
- GIVEN the Go CLI is running
- WHEN a session emits `bridge/session_event` or `bridge/tool_approval_requested` notifications
- THEN the CLI renders the events to the terminal in real time

### Requirement: MCP Server Management Methods
The bridge MUST expose the following methods for managing MCP server instances, scoped per workspace:

- `mcp.add` — Register and auto-start an MCP server for a workspace
- `mcp.remove` — Stop and remove an MCP server
- `mcp.start` — Start a stopped MCP server
- `mcp.stop` — Stop a running MCP server without removing its configuration
- `mcp.list` — List MCP servers for a workspace with their status

#### Scenario: Add an MCP server to a workspace
- GIVEN a client calls `mcp.add` with `{ workspace, name, command, args, env }`
- WHEN the bridge processes the request
- THEN the server configuration is persisted under the workspace's `.claude/mcp/` directory, the server process is started, and the response includes `{ name, status: "running", pid }`

#### Scenario: Remove an MCP server
- GIVEN an MCP server is configured and running for a workspace
- WHEN a client calls `mcp.remove` with `{ workspace, name }`
- THEN the server process is stopped, its configuration is deleted, and the response confirms removal

#### Scenario: Stop a running MCP server
- GIVEN an MCP server is running for a workspace
- WHEN a client calls `mcp.stop` with `{ workspace, name }`
- THEN the server process is terminated and the response includes `{ name, status: "stopped" }`

#### Scenario: Start a stopped MCP server
- GIVEN an MCP server is configured but stopped for a workspace
- WHEN a client calls `mcp.start` with `{ workspace, name }`
- THEN the server process is started and the response includes `{ name, status: "running", pid }`

#### Scenario: List MCP servers for a workspace
- GIVEN multiple MCP servers are configured for a workspace
- WHEN a client calls `mcp.list` with `{ workspace }`
- THEN the response includes a `servers` array where each entry has `name`, `status` (`"running"` | `"stopped"` | `"error"`), and optional `pid`

#### Scenario: MCP server name is unique per workspace
- GIVEN an MCP server named "my-server" already exists for a workspace
- WHEN a client calls `mcp.add` with the same workspace and name
- THEN the bridge returns a `-32602` error indicating the server name already exists

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
- GIVEN a client calls `config.get` with `{ key }`
- THEN the response includes `{ key, value, scope }` with the resolved value

#### Scenario: Set a project-scoped config value
- GIVEN a client calls `config.set` with `{ workspace, key, value, scope: "project" }`
- THEN the value is written to `<workspace>/.claude/settings.json`

#### Scenario: Set a user-scoped config value
- GIVEN a client calls `config.set` with `{ key, value, scope: "user" }`
- THEN the value is written to `~/.claude/settings.json`

#### Scenario: List all config
- GIVEN a client calls `config.list` with `{ workspace }`
- THEN the response includes a `settings` array showing each key with its resolved value

#### Scenario: Config validation for known keys
- GIVEN a client calls `config.set` with an invalid value for a known key
- THEN the bridge returns a `-32602` error indicating the value is invalid

#### Scenario: Unknown config keys are allowed
- GIVEN a client calls `config.set` with an unknown key
- THEN the value is stored without validation error (passthrough)

### Requirement: Config Capability Advertisement
The `bridge.capabilities` response MUST include `config.get`, `config.set`, and `config.list` in its supported methods list.

### Requirement: Hooks Management Methods
The bridge MUST expose the following methods for managing automation hooks:

- `hooks.add` — Register a new hook
- `hooks.remove` — Remove a hook by ID
- `hooks.list` — List configured hooks

A hook is defined by: `event` (the trigger event type), `command` (shell command to execute), `matcher` (optional tool name pattern), and `scope` (project or user).

Defined hook events: `pre_tool_use`, `post_tool_use`, `notification`, `stop`, `subagent_stop`

#### Scenario: Add a hook
- GIVEN a client calls `hooks.add` with `{ event, command, matcher?, scope, workspace? }`
- THEN the hook is persisted and the response includes `{ hookId, event, command, matcher, scope }`

#### Scenario: Remove a hook
- GIVEN a hook with a given ID exists
- WHEN a client calls `hooks.remove` with `{ hookId }`
- THEN the hook is deleted and the response confirms removal

#### Scenario: List hooks for a workspace
- GIVEN a client calls `hooks.list` with `{ workspace }`
- THEN the response includes all hooks (user-scoped and project-scoped)

#### Scenario: Invalid hook event is rejected
- GIVEN a client calls `hooks.add` with an invalid event type
- THEN the bridge returns a `-32602` error

### Requirement: Hook Execution Notification
When a hook fires during session execution, the bridge MUST emit a `bridge/hook_triggered` notification containing: `sessionId`, `hookId`, `event`, `command`, and `matcher` (if present).

Only `pre_tool_use` hooks block agent execution. All other hook events are fire-and-forget.

### Requirement: Hooks Capability Advertisement
The `bridge.capabilities` response MUST include `hooks.add`, `hooks.remove`, and `hooks.list` in its supported methods list, and MUST list the supported hook events.

### Requirement: Context Management Methods
The bridge MUST expose the following methods for managing context files (CLAUDE.md files, memory files, and `.claude/` directory contents):

- `context.read` — Read a context file's content
- `context.write` — Write a context file's content
- `context.list` — List available context files

Context operations operate in two scopes: `project` (workspace-relative) and `user` (`~/.claude/`).

For project scope, allowed paths are: `CLAUDE.md` at any directory depth, and any file under `.claude/`. For user scope, allowed paths are any file under `~/.claude/`.

All paths MUST be resolved to absolute paths and validated against the allowed base directory. Path traversal outside the allowed directory MUST be rejected with a `-32602` error.

Workspace path MUST be validated for existence before context read/write operations. If the workspace does not exist, the bridge MUST return a `-32001` error.

#### Scenario: Read a workspace CLAUDE.md
- GIVEN a workspace has a `CLAUDE.md` file at its root
- WHEN a client calls `context.read` with `{ scope: "project", workspace, path: "CLAUDE.md" }`
- THEN the response includes `{ scope, path, content }` with the file's content

#### Scenario: Read a user-scope context file
- GIVEN the user's `~/.claude/` directory contains a `settings.json` file
- WHEN a client calls `context.read` with `{ scope: "user", path: "settings.json" }`
- THEN the response includes the file content

#### Scenario: Read a non-existent file
- GIVEN a context file does not exist at the specified path
- WHEN a client calls `context.read`
- THEN the bridge returns a `-32001` error indicating the file was not found

#### Scenario: Write a context file
- GIVEN a client calls `context.write` with `{ scope: "project", workspace, path: "CLAUDE.md", content: "..." }`
- THEN the file is written and the response includes `{ scope, path, written: true }`

#### Scenario: Write creates parent directories
- GIVEN a client writes to `.claude/memory/my-notes.md` and the `.claude/memory/` directory does not exist
- WHEN the bridge processes the write
- THEN parent directories are created automatically

#### Scenario: Write rejects path traversal
- GIVEN a client calls `context.write` with `{ scope: "project", workspace, path: "../../etc/passwd", content: "..." }`
- WHEN the bridge validates the path
- THEN the bridge returns a `-32602` error indicating the path is outside the allowed directory

#### Scenario: List context files
- GIVEN a workspace has `CLAUDE.md` and `.claude/settings.json`
- WHEN a client calls `context.list` with `{ workspace }`
- THEN the response includes a `files` array with entries for both project and user scope files, each containing `scope`, `path` (relative), `size`, and `modifiedAt`

#### Scenario: List with user-only scope
- GIVEN a client calls `context.list` without a workspace
- WHEN the bridge processes the request
- THEN the response includes only user-scope files from `~/.claude/`

### Requirement: Context Capability Advertisement
The `bridge.capabilities` response MUST include `context.read`, `context.write`, and `context.list` in its supported methods list.

### Requirement: File Change Notification
The bridge MUST emit a `bridge/file_changed` notification when the agent uses a Write or Edit tool during a session.

For **Write** tool calls, the notification MUST include:
- `sessionId` (string)
- `path` (string, relative to workspace)
- `action` (`"created"` if the file did not exist before, `"modified"` if it did)

For **Edit** tool calls, the notification MUST include:
- `sessionId` (string)
- `path` (string, relative to workspace)
- `action` (`"modified"`)

The notification does NOT include file content or diff data to avoid leaking potentially sensitive information.

#### Scenario: Write tool emits file_changed with created action
- GIVEN a session is running and the agent uses the Write tool to create a new file
- WHEN the bridge detects the tool_use message
- THEN the bridge emits a `bridge/file_changed` notification with `action: "created"` and the relative file path

#### Scenario: Edit tool emits file_changed with modified action
- GIVEN a session is running and the agent uses the Edit tool on an existing file
- WHEN the bridge detects the tool_use message
- THEN the bridge emits a `bridge/file_changed` notification with `action: "modified"` and the relative file path

#### Scenario: Non-file tools do not emit file_changed
- GIVEN a session is running and the agent uses the Bash or Read tool
- WHEN the bridge processes the tool_use message
- THEN no `bridge/file_changed` notification is emitted

### Requirement: bridge.setLogLevel
The bridge MUST expose a `bridge.setLogLevel` method that changes the runtime log level.

Parameters: `{ level: string }` where `level` is one of `"trace"`, `"debug"`, `"info"`, `"warn"`, `"error"`.

If `level` is not a valid log level, the bridge MUST return a `-32602` error.

On success the bridge responds with `{ level: "<new-level>" }`.

The change takes effect immediately for all subsequent log output.

#### Scenario: Set log level to debug
- GIVEN the bridge is running with default log level `info`
- WHEN a client calls `bridge.setLogLevel` with `{ level: "debug" }`
- THEN the bridge responds with `{ level: "debug" }` and subsequent log output includes debug-level entries

#### Scenario: Reject invalid log level
- GIVEN a client calls `bridge.setLogLevel` with `{ level: "verbose" }`
- WHEN the bridge validates the request
- THEN the bridge returns a `-32602` error

### Requirement: Log Level Capability Advertisement
The `bridge.capabilities` response MUST include `bridge.setLogLevel` in its supported methods list.

### Requirement: API Version in Capabilities
The `bridge.capabilities` response MUST include an `apiVersion` field containing the current API version as a semver string (e.g., `"0.2.0"`).

#### Scenario: Capabilities include apiVersion
- GIVEN a client calls `bridge.capabilities`
- WHEN the bridge returns its capability metadata
- THEN the response includes an `apiVersion` field with a valid semver string matching the bridge's current API version

### Requirement: Version Negotiation Method
The bridge MUST expose a `bridge.negotiateVersion` method that allows clients to declare their supported versions and receive the negotiated result.

Parameters: `{supportedVersions: string[]}` where `supportedVersions` is a non-empty array of semver strings.

If one of the client's supported versions matches the bridge's `API_VERSION`, the bridge MUST respond with `{negotiatedVersion: string, capabilities: Capabilities}` where `negotiatedVersion` is the matched version and `capabilities` is the full capabilities object.

If no version matches, the bridge MUST return error code `-32050` with `supportedVersions` in the error data.

If `supportedVersions` is missing, empty, or contains non-string values, the bridge MUST return a `-32602` error.

#### Scenario: Successful version negotiation
- GIVEN a client calls `bridge.negotiateVersion` with `{supportedVersions: ["0.2.0"]}`
- WHEN the bridge's `API_VERSION` is `"0.2.0"`
- THEN the response includes `{negotiatedVersion: "0.2.0", capabilities: {...}}` with the full capabilities object

#### Scenario: No matching version
- GIVEN a client calls `bridge.negotiateVersion` with `{supportedVersions: ["99.0.0"]}`
- WHEN the bridge's `API_VERSION` is `"0.2.0"`
- THEN the bridge returns error code `-32050` with `supportedVersions: ["0.2.0"]` in the error data

#### Scenario: Invalid supportedVersions parameter
- GIVEN a client calls `bridge.negotiateVersion` with `{supportedVersions: []}`
- WHEN the bridge validates the request
- THEN the bridge returns a `-32602` error

### Requirement: Per-Request Version Validation
When a JSON-RPC request includes an `apiVersion` field in its `params`, the bridge MUST validate it against the current `API_VERSION`. If the version does not match, the bridge MUST return error code `-32050` with `supportedVersions` in the error data.

Requests that do not include an `apiVersion` field MUST be processed normally without version validation (opt-in behavior).

#### Scenario: Request with matching apiVersion
- GIVEN a client sends a request with `params: {apiVersion: "0.2.0", ...}`
- WHEN the bridge's `API_VERSION` is `"0.2.0"`
- THEN the request is processed normally

#### Scenario: Request with unsupported apiVersion
- GIVEN a client sends a request with `params: {apiVersion: "99.0.0", ...}`
- WHEN the bridge's `API_VERSION` is `"0.2.0"`
- THEN the bridge returns error code `-32050` with `supportedVersions: ["0.2.0"]` in the error data

#### Scenario: Request without apiVersion
- GIVEN a client sends a request without an `apiVersion` field in params
- WHEN the bridge processes the request
- THEN the request is processed normally (no version check applied)

### Requirement: Version Negotiation Capability Advertisement
The `bridge.capabilities` response MUST include `bridge.negotiateVersion` in its supported methods list.

#### Scenario: Capabilities include negotiateVersion
- GIVEN a client calls `bridge.capabilities`
- WHEN the bridge returns its capability metadata
- THEN the `methods` array includes `"bridge.negotiateVersion"`


### Requirement: Streaming Session Parameter
When `session.start` or `session.resume` is called with `stream: true`, the bridge MUST emit `stream_chunk` events for each text delta produced by the agent. When `stream` is omitted or `false`, the bridge MUST NOT emit `stream_chunk` events and behavior MUST be identical to current non-streaming behavior.

The `stream` parameter MUST be optional and default to `false`.

#### Scenario: Session started with streaming enabled
- GIVEN a client calls `session.start` with `{ ..., stream: true }`
- WHEN the agent produces text output
- THEN the bridge emits `stream_chunk` events for each text delta followed by a complete `assistant_text` event

#### Scenario: Session started without streaming (default)
- GIVEN a client calls `session.start` without a `stream` parameter
- WHEN the agent produces text output
- THEN the bridge emits only `assistant_text` events (no `stream_chunk`), identical to pre-streaming behavior

#### Scenario: Session resumed with streaming
- GIVEN a client calls `session.resume` with `{ sessionId, prompt, stream: true }`
- WHEN the agent produces text output
- THEN the bridge emits `stream_chunk` events followed by a complete `assistant_text` event

### Requirement: Stream Chunk Event
When streaming is enabled for a session, the bridge MUST emit a `bridge/session_event` notification with `type: "agent_message"` and `messageType: "stream_chunk"` for each `content_block_delta` event of type `text_delta` produced by the SDK.

Each `stream_chunk` event MUST include:
- `sessionId` (string)
- `type: "agent_message"`
- `messageType: "stream_chunk"`
- `content` (string — the text delta fragment)
- `index` (number — 0-based counter per assistant message turn, reset when a new assistant message begins)

After all `stream_chunk` events for an assistant message turn, the bridge MUST still emit the complete `assistant_text` event with the full text content.

`stream_chunk` events MUST NOT be emitted for `tool_use`, `tool_result`, or `result` message types.

#### Scenario: Text deltas produce stream_chunk events
- GIVEN a streaming session is active and the agent generates "Hello" then " world"
- WHEN the SDK emits two `content_block_delta` events with `type: "text_delta"`
- THEN the bridge emits two `stream_chunk` events with `content: "Hello"` and `content: " world"` respectively, followed by an `assistant_text` event with the full text

#### Scenario: Index increments per chunk within a turn
- GIVEN a streaming session receives three text deltas for one assistant message
- WHEN the bridge emits `stream_chunk` events
- THEN the `index` values are 0, 1, 2

#### Scenario: Index resets on new assistant message
- GIVEN a streaming session has emitted chunks with index 0..N for one assistant message
- WHEN the agent starts a new assistant message turn
- THEN the first `stream_chunk` of the new turn has `index: 0`

#### Scenario: Full assistant_text follows chunks
- GIVEN a streaming session has emitted `stream_chunk` events for an assistant message
- WHEN the complete assistant message arrives from the SDK
- THEN the bridge emits an `assistant_text` event with the complete text content

#### Scenario: Tool use does not produce stream_chunk
- GIVEN a streaming session is active and the agent emits a tool_use message
- WHEN the bridge processes the message
- THEN no `stream_chunk` event is emitted; only a `tool_use` event is emitted as usual

### Requirement: Streaming Capability Advertisement
The `bridge.capabilities` response MUST include a `streaming: true` field indicating that the bridge supports streaming token output.

#### Scenario: Capabilities include streaming field
- GIVEN a client calls `bridge.capabilities`
- WHEN the bridge returns its capability metadata
- THEN the response includes `streaming: true`
