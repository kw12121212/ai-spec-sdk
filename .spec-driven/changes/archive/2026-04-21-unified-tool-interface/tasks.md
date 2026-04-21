# Tasks: unified-tool-interface

## Implementation
- [x] Define the `UnifiedTool` interface and registry logic.
- [x] Update MCP tool discovery to register tools with the new unified registry using prefixed names.
- [x] Update LSP tool exposure to use the new unified registry.
- [x] Update the Claude Agent SDK wiring to consume tools exclusively from the unified registry.

## Testing

- [x] Run `bun run lint` — lint or validation task
- [x] Run `bun test` — unit test task

## Verification
- [x] Verify implementation matches proposal scope by ensuring the agent can invoke an MCP and an LSP tool through the unified registry without collision errors.
