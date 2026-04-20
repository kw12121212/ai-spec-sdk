---
mapping:
  implementation:
    - src/lsp-tools.ts
    - src/index.ts
  tests:
    - test/lsp-tools.test.ts
---

## ADDED Requirements

### Requirement: lsp-hover-tool
The system MUST provide an `lsp_hover` tool that retrieves hover information for a specific position in a file.

#### Scenario: success
- GIVEN an active `LspClient` connection
- WHEN the agent calls `lsp_hover` with a valid file URI, line, and character
- THEN the system sends a `textDocument/hover` request to the language server and returns the formatted response

### Requirement: lsp-definition-tool
The system MUST provide an `lsp_definition` tool that locates the definition of a symbol.

#### Scenario: success
- GIVEN an active `LspClient` connection
- WHEN the agent calls `lsp_definition` with a valid file URI, line, and character
- THEN the system sends a `textDocument/definition` request to the language server and returns the resolved location(s)

### Requirement: lsp-references-tool
The system MUST provide an `lsp_references` tool that finds all references to a symbol.

#### Scenario: success
- GIVEN an active `LspClient` connection
- WHEN the agent calls `lsp_references` with a valid file URI, line, and character
- THEN the system sends a `textDocument/references` request to the language server and returns the list of reference locations
