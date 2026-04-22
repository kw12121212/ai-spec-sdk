---
mapping:
  implementation:
    - src/lsp-tools.ts
    - src/index.ts
  tests:
    - test/lsp-tools.test.ts
---

## ADDED Requirements

### Requirement: lsp-diagnostics-tool
The system MUST provide an `lsp_diagnostics` tool that retrieves the current diagnostics for a specific file.

#### Scenario: success
- GIVEN an active `LspClient` connection that has received diagnostics for a file
- WHEN the agent calls `lsp_diagnostics` with a valid file URI
- THEN the system returns the stored diagnostics for that file
