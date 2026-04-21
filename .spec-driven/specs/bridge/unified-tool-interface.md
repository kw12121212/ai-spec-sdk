---
mapping:
  implementation:
    - src/unified-tool-registry.ts
  tests:
    - test/unified-tool-registry.test.ts
---

## ADDED Requirements

### Requirement: unified-tool-registration
The system MUST provide a unified mechanism to register tools originating from various providers (LSP, MCP, native custom tools).

#### Scenario: registration
- GIVEN multiple tool providers
- WHEN tools are registered with the unified interface
- THEN the system MUST store them in a single, queryable registry accessible by the agent.

### Requirement: tool-name-prefixing
The system MUST prevent tool name collisions by prefixing tool names with their provider ID.

#### Scenario: collision-avoidance
- GIVEN a provider with ID `my_server` providing a tool named `query`
- WHEN the tool is registered with the unified interface
- THEN the tool MUST be exposed to the agent as `my_server_query`.

### Requirement: unified-tool-execution
The system MUST route tool execution requests from the agent to the appropriate underlying provider.

#### Scenario: execution-routing
- GIVEN a registered tool `my_server_query`
- WHEN the agent requests to execute `my_server_query`
- THEN the system MUST strip the prefix, route the execution to `my_server`, and return the result.
