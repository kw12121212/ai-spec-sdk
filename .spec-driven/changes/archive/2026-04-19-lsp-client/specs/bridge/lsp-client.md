---
mapping:
  implementation:
    - src/lsp-client.ts
    - src/lsp-types.ts
    - src/index.ts
  tests:
    - test/lsp-client.test.ts
---

## ADDED Requirements

### Requirement: lsp-process-management
The system MUST be able to spawn an LSP server as a child process and manage its lifecycle.

#### Scenario: success
- GIVEN a valid path to an LSP server executable
- WHEN the client connects
- THEN the process is spawned and the initialization handshake completes successfully.

### Requirement: lsp-json-rpc-communication
The system MUST send and receive standard LSP JSON-RPC 2.0 messages over the child process standard I/O streams.

#### Scenario: success
- GIVEN an initialized LSP client
- WHEN a request (e.g., `textDocument/hover`) is sent
- THEN a properly formatted JSON-RPC request is written to stdin and the response parsed from stdout.
