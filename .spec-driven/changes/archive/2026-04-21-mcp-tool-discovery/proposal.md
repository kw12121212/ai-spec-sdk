# Proposal: mcp-tool-discovery

## What
Add dynamic MCP tool discovery and registration capabilities to the SDK.

## Why
Currently, the SDK connects to an MCP server and can invoke tools, but it relies on external discovery or manual registration to know what tools are available. Implementing discovery over the MCP protocol (`tools/list`) enables seamless integration and dynamic availability of external tools to the agent SDK.

## Scope
- Fetch available tools from an MCP server using the `tools/list` request upon connection.
- Convert the discovered tools into the SDK-compatible format and register them dynamically.
- Expose these tools so they can be invoked by the Claude Agent SDK.

## Unchanged Behavior
- Core MCP connection and stdio streaming logic remains unchanged.
- Execution logic for `tools/call` remains unchanged.
- Non-MCP tools and other extensions remain unaffected.
