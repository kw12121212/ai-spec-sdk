# Tasks: mcp-tool-discovery

## Implementation
- [x] Send `tools/list` request after MCP server initialization is complete in `McpStore`.
- [x] Map the returned MCP tools to the agent SDK tool format and expose them.
- [x] Ensure that dynamically discovered tools can be executed via the existing `tools/call` flow.

## Testing
- [x] Run `npm run lint` — lint and validate codebase formatting and typing.
- [x] Run `bun test` — unit test the new tool discovery flow and tool format mapping.

## Verification
- [x] Verify implementation matches proposal scope
