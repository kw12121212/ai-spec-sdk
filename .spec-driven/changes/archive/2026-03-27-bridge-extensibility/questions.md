# Questions: bridge-extensibility

## Open

<!-- No open questions -->

## Resolved

- [x] Q: Should MCP servers be scoped per workspace or global?
  Context: Determines storage location and lifecycle isolation for MCP server processes.
  A: Per workspace. Each workspace has its own MCP server set, matching Claude Code behavior.

- [x] Q: Should hooks be managed via dedicated `hooks.*` methods or through `config.set`?
  Context: Affects API surface and whether hooks are first-class or just config entries.
  A: Dedicated `hooks.*` methods for clearer semantics and better validation.

- [x] Q: Should MCP servers auto-start when added?
  Context: Affects whether consumers need a separate `mcp.start` call after `mcp.add`.
  A: Yes, `mcp.add` immediately starts the server process to reduce round-trips.
