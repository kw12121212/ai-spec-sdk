# Tasks: lsp-diagnostics

## Implementation
- [x] Define LSP diagnostic interfaces (`Diagnostic`, `DiagnosticSeverity`, `PublishDiagnosticsParams`) in `src/lsp-types.ts`
- [x] Update `LspClient` to listen for `textDocument/publishDiagnostics` and store the result internally
- [x] Add `getDiagnostics(uri: string)` method to `LspClient`
- [x] Implement the `lsp_diagnostics` tool in `src/lsp-tools.ts`
- [x] Export the new tool in `src/index.ts`

## Testing
- [x] Write unit tests for `LspClient` diagnostic handling in `test/lsp-client.test.ts`
- [x] Write unit tests for the `lsp_diagnostics` tool in `test/lsp-tools.test.ts`
- [x] Run `npm run lint` — validate TypeScript definitions and formatting
- [x] Run `npm run test` — verify the unit tests pass

## Verification
- [x] Verify implementation matches proposal scope and correctly exposes diagnostics to the agent
