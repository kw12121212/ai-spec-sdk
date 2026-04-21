# Tasks: mcp-adapter

## Implementation
- [x] Update `McpStore` to attach stdio protocol clients to spawned MCP servers.
- [x] Add `initialize` and `tools/list` protocol methods to the MCP adapter.
- [x] Update the bridge command router to forward tool calls to the appropriate MCP adapter.

## Testing

- [x] Run `npm run lint` — to validate formatting and types.
- [x] Run `npm run test` — to execute the unit tests for the MCP adapter logic.

## Verification
- [x] Verify implementation matches proposal scope