# Proposal: lsp-tools

## What
Expose Language Server Protocol (LSP) capabilities (hover, definition, and references) as Claude Agent SDK tools using the existing `LspClient` integration.

## Why
Agents need semantic code understanding to be effective. The LSP client connection was established in the `lsp-client` milestone, but without tools exposing those capabilities, the agent cannot actually query code intelligence. Adding these specific tools bridges that gap.

## Scope
- Create an `LspTools` registry/factory that binds an `LspClient` instance to Claude Agent SDK tool definitions.
- Implement the `lsp_hover` tool (using `textDocument/hover`).
- Implement the `lsp_definition` tool (using `textDocument/definition`).
- Implement the `lsp_references` tool (using `textDocument/references`).
- Include validation and unit tests verifying tool inputs and outputs against the LSP client interface.

## Unchanged Behavior
- The core `LspClient` connection logic and process lifecycle management remains unchanged.
- The overall bridge architecture and agent session behavior remain unchanged.
