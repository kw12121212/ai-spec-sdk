# JSON-RPC 2.0 Stdio Transport (Delta)

## ADDED Requirements

## `session.spawn` Method

### Requirement: The bridge MUST implement a `session.spawn` JSON-RPC method.
- **Parameters**: MUST accept `parentSessionId` (string, required) and other session configuration parameters (similar to `session.start`).
- **Result**: MUST return the `sessionId` of the newly created child session.

## `bridge/subagent_event` Notification

### Requirement: The bridge MUST emit a `bridge/subagent_event` notification for parent-linked child session activity.
- **Method**: `bridge/subagent_event`
- **Params**:
  - `sessionId`: The parent session ID.
  - `subagentId`: The child session ID.
  - `type`: The propagated child event type. Implementations MUST emit at least terminal child events and MAY emit child message events.
  - `status`: The terminal child status when `type` represents child completion or stop.

## MODIFIED Requirements

## `session.list` Filtering

### Requirement: The `session.list` method params MUST accept an optional `parentSessionId` (string) parameter to filter the returned sessions to only the children of the specified parent.

## Session Metadata

### Requirement: Session metadata responses MUST include a `parentSessionId` field.
- `session.status`, `session.list`, and `session.export` MUST expose `parentSessionId`.
- Root sessions MUST report `parentSessionId: null`.
