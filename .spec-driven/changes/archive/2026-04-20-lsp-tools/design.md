# Design: lsp-tools

## Approach
Create an adapter class or factory function (e.g., `createLspTools(client: LspClient)`) that returns a list of Claude Agent SDK compatible tool objects. Each tool definition will map its arguments (like `uri`, `line`, `character`) to the standard LSP structures and call the corresponding `client.getConnection().sendRequest(...)`.

## Key Decisions
- **Tool Naming**: Prefix tools with `lsp_` (e.g., `lsp_hover`) to avoid collisions with standard or MCP tools.
- **Error Handling**: LSP errors (like missing document or unsupported capability) will be caught and returned as clean text messages in the tool output rather than crashing the tool call.

## Alternatives Considered
- Directly exposing the entire LSP protocol as a single "send_lsp_request" tool. This was rejected because agents struggle with constructing raw LSP JSON-RPC payloads and benefit more from well-typed, specific tools like "hover".
