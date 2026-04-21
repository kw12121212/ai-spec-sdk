---
mapping:
  implementation:
    - src/mcp-store.ts
    - src/bridge.ts
  tests:
    - test/mcp-store.test.ts
---

## ADDED Requirements

### Requirement: mcp-tool-discovery
The system MUST discover available tools from an MCP server upon connection.

#### Scenario: tool-list
- GIVEN a connected and initialized MCP server
- WHEN the server is marked as ready
- THEN the system MUST send a `tools/list` request to the MCP server
- AND expose the returned tools for use by the agent SDK
