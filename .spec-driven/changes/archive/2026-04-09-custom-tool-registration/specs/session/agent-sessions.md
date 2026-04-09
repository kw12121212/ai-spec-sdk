## ADDED Requirements

### Requirement: Custom Tools in Session Control Parameters
The `allowedTools` and `disallowedTools` parameters on `session.start` and `session.resume` MUST accept custom tool names (prefixed with `custom.`).

#### Scenario: Allow custom tools in session
- GIVEN a workspace with registered custom tools `custom.build` and `custom.test`
- WHEN the client starts a session with `allowedTools: ["Read", "custom.build"]`
- THEN the agent receives both the `Read` tool and the `custom.build` tool definition
- AND the `custom.test` tool is not available to the agent

#### Scenario: Disallow specific custom tools
- GIVEN a workspace with registered custom tools
- WHEN the client starts a session with `disallowedTools: ["custom.deploy"]`
- THEN all custom tools except `custom.deploy` are available if listed in `allowedTools`

### Requirement: Custom Tool Execution Context
Custom tools invoked by the agent MUST execute in the session's workspace directory with proper error handling.

#### Scenario: Custom tool executes in workspace
- GIVEN an active session for workspace `/home/user/project`
- WHEN the agent invokes a custom tool registered for that workspace
- THEN the shell command executes with `cwd` set to `/home/user/project`

#### Scenario: Custom tool execution failure
- GIVEN a custom tool that executes a failing command
- WHEN the agent invokes the tool
- THEN the error is captured and returned to the agent as a tool error result
