# Proposal: mcp-adapter

## What
Implement an adapter for the Model Context Protocol (MCP) to allow the AI Spec SDK to communicate with external MCP servers. The SDK will manage the lifecycle of these servers and provide a standardized interface to invoke tools exposed by them.

## Why
This is a core requirement of Milestone 11. It allows AI agents to interact with external tools and data sources that conform to the MCP standard, significantly expanding the capabilities of the system beyond built-in or custom JSON-RPC tools.

## Scope
- Implement the MCP protocol client interface.
- Manage child processes for local MCP servers.
- Expose JSON-RPC endpoints on the bridge to list, start, stop, and query MCP servers.
- Route tool execution requests from the AI agent to the appropriate MCP server.

## Unchanged Behavior
- The existing JSON-RPC bridge protocol remains unchanged.
- The `McpStore` lifecycle management (start/stop/list) remains intact but will be extended to support actual protocol interactions.
- The LSP integration is untouched.