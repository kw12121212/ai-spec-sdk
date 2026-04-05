# Bridge Foundation

## Goal
Establish the polyglot JSON-RPC 2.0 bridge with full session management, Claude Agent SDK integration, extensibility (MCP/config/hooks), and a Go CLI reference implementation.

## In Scope
- stdio transport with JSON-RPC 2.0 framing
- Claude Agent SDK session lifecycle (start, resume, stop, status)
- MCP server management, configuration management, and hooks system
- Session history, persistence, and listing
- Tool approval flow (permissionMode + approveTool/rejectTool)
- Go CLI REPL demonstrating all bridge methods

## Out of Scope
- HTTP/SSE transport (see 02-production-ready)
- Authentication (see 02-production-ready)
- Client SDKs (see 02-production-ready)

## Done Criteria
- Bridge accepts JSON-RPC requests over stdio
- All core session lifecycle methods callable and tested
- MCP server management, config, and hooks methods operational
- Go CLI demo compiles and connects to bridge subprocess

## Planned Changes
- `add-polyglot-agent-spec-bridge` - polyglot stdio bridge with JSON-RPC 2.0
- `agent-session-sdk-wiring` - Claude Agent SDK session wiring with proxy support
- `bridge-extensibility` - MCP server management, config management, and hooks
- `session-depth` - session history, persistence, and listing
- `tool-approval-flow` - permissionMode approve and approveTool/rejectTool

## Dependencies
None — this is the foundation milestone.

## Risks
None — all planned changes are archived.

## Status
- Declared: complete

## Notes
Additional archived changes not listed above: bridge-integrator-gaps (event schema, session sub-type contracts), bridge-session-ux (context management, branching, search), gui-discovery-apis (models.list, workspace registry, tools.list), gui-important-gaps (bridge.ping, events replay, token usage), go-cli-example, compile-native-executable, add-helper-scripts.

Network proxy forwarding (specs/network/proxy-forwarding.md) is implemented as part of agent-session-sdk-wiring; no separate change required.
