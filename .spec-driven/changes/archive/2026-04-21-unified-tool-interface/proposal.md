# Proposal: unified-tool-interface

## What
Create a common, unified tool interface that abstracts away the underlying differences between Language Server Protocol (LSP) tools, Model Context Protocol (MCP) tools, and native custom tools. It will provide a single contract for tool registration, discovery, validation, and execution within the core agent workflow.

## Why
With `lsp-client`, `lsp-tools`, `mcp-adapter`, and `mcp-tool-discovery` already completed, the system now has multiple sources of tools. A unified interface is the immediate logical next step to prevent the core agent orchestrator from becoming tightly coupled to specific protocols and to allow it to seamlessly consume all available tools.

## Scope
- Define `UnifiedTool` interface or equivalent.
- Implement a `ToolRegistry` to hold and discover tools from all providers (LSP, MCP, custom).
- Automatically prefix tool names with their provider/server ID to avoid collisions (e.g., `mcp_db_query` instead of just `query`).
- Expose these tools to the Claude Agent SDK via a unified interface.

## Unchanged Behavior
- Existing LSP and MCP adapter implementations will remain structurally the same, but will plug into the new interface.
- Core transport and authentication logic will not change.
