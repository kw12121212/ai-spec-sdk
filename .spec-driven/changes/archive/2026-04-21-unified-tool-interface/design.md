# Design: unified-tool-interface

## Approach
We will introduce a `UnifiedToolRegistry` or similar abstraction in `src/unified-tool-registry.ts` or `src/capabilities.ts`.
This registry will collect tools from `lsp-tools.ts`, `mcp-store.ts`, and `workspace-store.ts` (custom tools).
To handle tool name collisions (e.g. if two MCP servers provide tools with the same name), we will automatically prefix the tool names with their provider or server ID during registration. The registry will then map tool executions back to the correct underlying provider based on the prefix.

## Key Decisions
- **Prefixing:** Tool names will be prefixed automatically to ensure uniqueness across different providers and servers.
- **Abstraction Layer:** The core agent runner will only interact with the unified interface and will not require specific knowledge of LSP or MCP details.

## Alternatives Considered
- **No Prefixing:** We considered requiring manual aliasing for tool name collisions, but this places a burden on the user. Automatic prefixing is safer.
- **Provider-specific Tool Stores:** We considered letting the core orchestrator check multiple stores sequentially. However, a single registry simplifies tool discovery for the agent.
