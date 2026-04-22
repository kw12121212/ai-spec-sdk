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

### Requirement: lsp-diagnostics-storage
The system MUST be able to receive and store `textDocument/publishDiagnostics` notifications from the connected LSP server.

#### Scenario: success
- GIVEN an initialized LSP client
- WHEN the server sends a `textDocument/publishDiagnostics` notification containing diagnostic items for a specific file URI
- THEN the client stores the updated diagnostics for that file URI.

### Requirement: lsp-diagnostics-retrieval
The system MUST provide a method to retrieve the most recent diagnostics for a specific file URI.

#### Scenario: success
- GIVEN an LSP client that has received diagnostics for `file:///path/to/file.ts`
- WHEN the `getDiagnostics(uri)` method is called with `file:///path/to/file.ts`
- THEN the client returns the stored array of diagnostic items.
