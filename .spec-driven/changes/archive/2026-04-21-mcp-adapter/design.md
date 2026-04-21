# Design: mcp-adapter

## Approach
- Enhance the existing `McpStore` to not only manage the child processes but to attach a lightweight MCP client (using stdio transport) to the running servers.
- Introduce `McpAdapter` or enhance `McpStore` methods to wrap the protocol specifics (like tool discovery and tool execution).
- Map bridge requests (e.g., `execute_tool`) to MCP requests if the tool name indicates it is provided by an MCP server.

## Key Decisions
- **Transport**: Stdio will be the primary transport mechanism for MCP servers, as they are managed locally by the SDK.
- **Protocol Abstraction**: We will build a lightweight wrapper over the MCP protocol (or use an existing minimal MCP client library if available) to translate between the bridge's tool execution format and MCP's `tools/call`.

## Alternatives Considered
- Integrating an external MCP proxy layer, but that would violate our goal of having a single integrated bridge for SDK consumers.