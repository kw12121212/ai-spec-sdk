# LSP and MCP Tool Integration

## Goal
Integrate Language Server Protocol (LSP) clients and Model Context Protocol (MCP) adapters as first-class tools for enhanced code intelligence and external service connectivity.

## In Scope
- LSP client integration for code analysis, completion, and diagnostics
- MCP server management and tool discovery
- Unified tool interface abstracting LSP and MCP operations
- Bi-directional communication with LSP servers
- MCP resource subscription and notification handling

## Out of Scope
- Implementing LSP servers (we are the client)
- Hosting MCP servers (we connect to external ones)
- Language-specific parsing or AST generation

## Done Criteria
- LSP tools can start servers, send requests, and receive responses
- MCP tools can connect to servers, list available tools, and invoke them
- Unified interface treats LSP and MCP operations consistently
- LSP diagnostics are surfaced as agent observations
- MCP resource updates trigger agent notifications

## Planned Changes
- `lsp-client` - Declared: complete - LSP client implementation
- `lsp-tools` - Declared: complete - code analysis, completion, hover tools
- `mcp-adapter` - Declared: planned - MCP protocol adapter
- `mcp-tool-discovery` - Declared: planned - dynamic MCP tool registration
- `unified-tool-interface` - Declared: planned - common interface for LSP/MCP
- `lsp-diagnostics` - Declared: planned - diagnostic aggregation and reporting

## Dependencies
- 03-platform-reach — builds on custom tool registration infrastructure
- 09-permissions-hooks — integrates with permission system for external tools

## Risks
- LSP servers may have incompatible versions or capabilities
- MCP is evolving; protocol changes may require updates
- External server lifecycle management adds complexity

## Status
- Declared: proposed

## Notes



