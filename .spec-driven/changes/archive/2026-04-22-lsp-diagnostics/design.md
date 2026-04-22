# Design: lsp-diagnostics

## Approach
1. **LSP Client State:** Update the `LspClient` class to maintain an internal map of file URIs to their most recent diagnostics.
2. **Notification Handling:** Add a listener for the `textDocument/publishDiagnostics` notification in the `LspClient` message handler. When received, update the internal state for the given `uri`.
3. **Tool Implementation:** Add a new `lsp_diagnostics` tool to the `lsp-tools.ts` registry. This tool will take a `uri` as an argument and return the current diagnostics for that file.
4. **Data Structures:** Define appropriate TypeScript interfaces for LSP diagnostics (e.g., `Diagnostic`, `DiagnosticSeverity`, `PublishDiagnosticsParams`) in `src/lsp-types.ts`.

## Key Decisions
- **Pull-Based Retrieval:** Diagnostics are retrieved by the agent on demand via the `lsp_diagnostics` tool, rather than pushed asynchronously into the agent's context. This aligns with the existing tool-based interaction model and is simpler to orchestrate.
- **State Storage:** The diagnostics state is tied to the `LspClient` instance. If the client disconnects or restarts, the diagnostics state is reset.

## Alternatives Considered
- **Push-Based Notifications:** We could have implemented a system where diagnostics are automatically sent as messages to the agent whenever they change. This was rejected because it introduces asynchronous complexity, potential noise for the agent, and breaks the standard request/response tool paradigm.
