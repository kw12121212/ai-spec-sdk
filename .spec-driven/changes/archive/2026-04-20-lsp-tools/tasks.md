# Tasks: lsp-tools

## Implementation
- [x] Implement `src/lsp-tools.ts` with `lsp_hover`, `lsp_definition`, and `lsp_references` tool definitions using Claude Agent SDK types.
- [x] Export the new tools from `src/index.ts`.

## Testing
- [x] Run `bun run lint` — lint and validate TypeScript types.
- [x] Run `bun test test/lsp-tools.test.ts` — unit test task for the LSP tools.

## Verification
- [x] Verify implementation matches proposal scope by ensuring all three LSP tools correctly format requests and parse responses.
