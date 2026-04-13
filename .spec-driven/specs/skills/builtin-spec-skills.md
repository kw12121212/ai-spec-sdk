---
mapping:
  implementation:
    - src/bridge.ts
    - src/capabilities.ts
    - src/mcp-store.ts
  tests:
    - test/mcp-store.test.ts
---
### Requirement: Built-in Skill Discovery
The SDK MUST let clients discover which spec-driven skills are bundled and available through the current SDK distribution.

#### Scenario: List bundled skills
- GIVEN a client wants to understand the spec-driven capabilities packaged with the SDK
- WHEN the client requests bundled skill information
- THEN the bridge returns machine-readable metadata describing the bundled spec-driven skills

### Requirement: Workflow and Skill Alignment
The SDK SHOULD report which bundled skills back the supported high-level workflow operations so host tools can present understandable capability descriptions without depending on internal file layouts.

#### Scenario: Describe workflow support
- GIVEN a client inspects the bridge capability metadata
- WHEN the bridge reports supported workflow operations
- THEN the response identifies the related bundled spec-driven capabilities in a machine-readable form

### Requirement: Custom Tool Registration
The SDK MUST let clients register workspace-scoped shell-command tools that extend the available tool set beyond built-ins.

#### Scenario: Register a custom tool
- GIVEN a registered workspace path and valid tool parameters
- WHEN the client calls `tools.register` with `name` (prefixed with `custom.`), `description`, `command`, and optional `args`
- THEN the tool is stored for that workspace and returned with a `registeredAt` timestamp

#### Scenario: Reject invalid custom tool names
- GIVEN a client attempts to register a tool with a name not starting with `custom.`
- WHEN the bridge validates the request
- THEN the bridge returns a `-32602` error indicating the naming requirement

#### Scenario: Reject unregistered workspace
- GIVEN a client attempts to register a tool for a workspace that was not previously registered via `workspace.register`
- WHEN the bridge validates the request
- THEN the bridge returns a `-32602` error indicating the workspace must be registered first

### Requirement: Custom Tool Unregistration
The SDK MUST let clients remove previously registered custom tools from a workspace.

#### Scenario: Unregister a custom tool
- GIVEN a workspace with a previously registered custom tool
- WHEN the client calls `tools.unregister` with the workspace path and tool name
- THEN the tool is removed and `{ success: true }` is returned

#### Scenario: Unregister non-existent tool
- GIVEN a client calls `tools.unregister` for a tool that does not exist
- WHEN the bridge processes the request
- THEN `{ success: false }` is returned without error

### Requirement: Custom Tool Discovery
The SDK MUST include custom tools in the `tools.list` response when a workspace is specified.

#### Scenario: List tools for a workspace
- GIVEN a workspace with registered custom tools
- WHEN the client calls `tools.list` with a `workspace` parameter
- THEN the response includes both built-in tools and custom tools for that workspace

#### Scenario: List only built-in tools
- GIVEN a client calls `tools.list` without a `workspace` parameter
- WHEN the bridge processes the request
- THEN only built-in tools are returned (backward compatible behavior)

### Requirement: Custom Tool Execution
The SDK MUST execute custom tools as shell commands in the workspace directory when invoked by the agent.

#### Scenario: Execute custom tool
- GIVEN an active session with a custom tool in `allowedTools`
- WHEN the agent invokes the custom tool
- THEN the bridge executes the configured `command` with `args` in the session's workspace directory
- AND the stdout/stderr is captured and returned to the agent as the tool result

#### Scenario: Custom tool respects permissions
- GIVEN a session started with `allowedTools` that does not include a specific custom tool
- WHEN the agent attempts to invoke that tool
- THEN the agent does not receive the tool definition and cannot invoke it

### Requirement: Custom Tool Hooks Integration
Custom tool invocations MUST trigger the same hooks as built-in tools.

#### Scenario: Pre-tool-use hook for custom tool
- GIVEN a registered `pre_tool_use` hook
- WHEN a custom tool is invoked
- THEN the hook receives the tool name and input, and can allow or deny the invocation

### Requirement: MCP Server Management
The bridge MUST expose MCP (Model Context Protocol) server lifecycle management methods that allow clients to register, start, stop, and list MCP servers scoped to a workspace.

#### Scenario: Register and auto-start an MCP server
- GIVEN a client calls `mcp.add` with `{ workspace, name, command, args?, env? }`
- WHEN the bridge validates the request
- THEN the MCP server config is persisted to `<workspace>/.claude/mcp/<name>.json`
- AND the server process is started automatically
- AND the response includes `{ name, status: "running", pid }`
- AND a `mcp/server_started` notification is emitted

#### Scenario: Reject duplicate MCP server name
- GIVEN an MCP server with name "test-server" already exists for a workspace
- WHEN the client calls `mcp.add` with the same name
- THEN the bridge returns a `-32602` error indicating the server already exists

#### Scenario: Remove and stop an MCP server
- GIVEN a running MCP server exists
- WHEN the client calls `mcp.remove` with `{ workspace, name }`
- THEN the server process is stopped
- AND the config file is deleted
- AND `{ name, removed: true }` is returned

#### Scenario: Start a stopped MCP server
- GIVEN an MCP server with status "stopped"
- WHEN the client calls `mcp.start` with `{ workspace, name }`
- THEN the server process is restarted
- AND `{ name, status: "running", pid }` is returned

#### Scenario: Stop a running MCP server
- GIVEN an MCP server with status "running"
- WHEN the client calls `mcp.stop` with `{ workspace, name }`
- THEN the server process is terminated
- AND `{ name, status: "stopped" }` is returned

#### Scenario: List MCP servers for workspace
- GIVEN multiple MCP servers are registered for a workspace
- WHEN the client calls `mcp.list` with `{ workspace }`
- THEN the response includes `{ servers: [...] }` with each server's name, command, status, and pid

#### Scenario: Workspace scoping isolates MCP servers
- GIVEN two different workspaces each have an MCP server named "db"
- WHEN the client lists servers for each workspace
- THEN each workspace only sees its own "db" server

#### Scenario: Invalid workspace returns error
- GIVEN a non-existent path is provided as workspace
- WHEN any mcp.* method is called
- THEN the bridge returns a `-32001` error

### Requirement: Capabilities include mcp methods
The `bridge.capabilities` response MUST include `mcp.add`, `mcp.remove`, `mcp.start`, `mcp.stop`, and `mcp.list` in the supported methods list.

#### Scenario: Capabilities include MCP methods
- GIVEN a client calls `bridge.capabilities`
- THEN the `methods` array includes all five `mcp.*` method names
