## ADDED Requirements

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
