# Design: lsp-client

## Approach
We will build a new client layer that speaks the LSP JSON-RPC protocol over standard I/O to a spawned child process. This will likely integrate as a specialized transport or client manager within the system, similar to how we manage agent sessions or MCP tools.

## Key Decisions
- The implementation will start by spawning local language server binaries using standard input/output for JSON-RPC communication.
- The `lsp-client` module will abstract the raw JSON-RPC messages into strongly-typed methods corresponding to common LSP endpoints (e.g., `initialize`, `textDocument/didOpen`, `textDocument/completion`).

## Alternatives Considered
- **Direct REST/HTTP Calls:** Not viable as LSP is fundamentally a JSON-RPC protocol.
- **Using a heavyweight generic JSON-RPC library:** Might add unnecessary dependencies; we could reuse existing `bridge.ts` JSON-RPC logic if it fits cleanly.
