# Advanced Runtime

## Goal
Enable real-time bidirectional communication via WebSocket and multi-agent coordination with parent-child session relationships.

## In Scope
- WebSocket transport with JSON-RPC 2.0 framing, ping/pong keepalive, and session-scoped event subscriptions
- Parent-child agent sessions via session.spawn, with child completion events propagated to parent

## Out of Scope
- Binary WebSocket frames or permessage-deflate compression
- Distributed multi-bridge orchestration
- Persistent agent networks or agent pools
- Cost allocation per sub-agent

## Done Criteria
- Bridge starts with --transport ws; clients send requests and receive notifications on a single connection
- session.spawn creates a child session; parent receives bridge/subagent_event notifications on completion
- Child sessions visible in session.list with parentSessionId filter

## Planned Changes
- `websocket-transport` - Declared: complete - bidirectional WebSocket transport with ping/pong keepalive
- `multi-agent-orchestration` - Declared: complete - parent-child agent sessions via session.spawn

## Dependencies
- 02-production-ready — WebSocket builds on HTTP/SSE transport patterns; multi-agent requires session persistence

## Risks
- multi-agent-orchestration adds significant SessionStore complexity; notification ordering and delivery need careful design.
- The two changes are independent and can ship separately if needed.

## Status
- Declared: complete

## Notes
Intentionally limited to two changes; both are architecturally significant and warrant focused implementation. websocket-transport can ship independently of multi-agent-orchestration if sequencing is needed.



