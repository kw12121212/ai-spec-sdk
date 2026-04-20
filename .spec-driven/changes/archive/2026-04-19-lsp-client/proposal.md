# Proposal: lsp-client

## What
Implement a Language Server Protocol (LSP) client. This will enable the system to connect to external LSP servers to perform code analysis, completion, and gather diagnostics.

## Why
This change is the foundational step for Milestone 11 "LSP and MCP Tool Integration". By implementing an LSP client, we unlock the ability to build advanced code intelligence tools (`lsp-tools`) on top of it, significantly expanding the SDK's capabilities.

## Scope
- Implement a JSON-RPC-based client capable of speaking the Language Server Protocol.
- Add lifecycle management for starting and communicating with an LSP server process.
- Map responses back to our system's tool interface or internal state.

## Unchanged Behavior
- Existing JSON-RPC and WebSocket bridge transports remain unaffected.
- We will not implement an LSP *server*, only the client.
- Language-specific AST parsing remains outside the SDK boundary.
