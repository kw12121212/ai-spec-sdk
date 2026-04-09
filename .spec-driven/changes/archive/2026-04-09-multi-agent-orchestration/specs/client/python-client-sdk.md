# Python Client SDK (Delta)

## ADDED Requirements

## Python SDK Additions

### Requirement: The `ai-spec-sdk` PyPI package MUST expose an async `spawn` method on the `BridgeClient` class.
- `spawn(parent_session_id: str, **kwargs)` MUST invoke the underlying `session.spawn` JSON-RPC method.

### Requirement: The event listener system MUST support `bridge/subagent_event` notification handlers.
- Registered handlers MUST receive the notification params, including `sessionId`, `subagentId`, and child `type`.

## MODIFIED Requirements

### Requirement: `list(parent_session_id: Optional[str] = None)` MUST be supported for filtering by parent session ID.

### Requirement: Session metadata helper types MUST include `parentSessionId`.
- Python request/response helper types for session metadata MUST surface `parentSessionId` when the bridge provides it.
