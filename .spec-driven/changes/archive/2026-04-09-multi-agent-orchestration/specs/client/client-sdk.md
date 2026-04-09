# Client SDK (Delta)

## ADDED Requirements

## TypeScript SDK Additions

### Requirement: The `@ai-spec-sdk/client` MUST expose a `spawn` method that wraps the `session.spawn` JSON-RPC method.
- The `spawn` method MUST accept a `parentSessionId` and standard session configuration options.

### Requirement: The SDK MUST expose the `bridge/subagent_event` notification in its strongly typed event handlers (e.g., `on("bridge/subagent_event", handler)`).
- The notification payload MUST include `sessionId`, `subagentId`, and the propagated child `type`.

## MODIFIED Requirements

### Requirement: The `list` method MUST accept an optional `parentSessionId` filter parameter.

### Requirement: Session metadata types MUST include `parentSessionId`.
- Session list entries and session status/export result types MUST expose `parentSessionId` as `string | null`.
