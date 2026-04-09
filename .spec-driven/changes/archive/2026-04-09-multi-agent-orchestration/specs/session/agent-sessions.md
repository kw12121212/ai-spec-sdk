# Agent Sessions (Delta)

## ADDED Requirements

## session.spawn

### Requirement: The bridge MUST support creating a child session from a parent session via `session.spawn`.
- A child session MUST be linked to the parent via `parentSessionId`.
- The child session MUST inherit the workspace boundary of the parent.
- If a parent session is stopped, the bridge MUST recursively cascade the `session.stop` operation to all of its active child sessions.

## Lifecycle Event Propagation

### Requirement: When a child session emits parent-relevant activity, the parent session MUST emit a `bridge/subagent_event` notification.
- The event MUST include the child session identifier as `subagentId`.
- The event MUST include the propagated child event `type`.
- Terminal child notifications MUST include the child completion/stop status.

## MODIFIED Requirements

## session.list

### Requirement: The `session.list` method MUST accept an optional `parentSessionId` filter to list only child sessions belonging to the specified parent.

## Session Metadata

### Requirement: Session metadata returned by the bridge MUST expose parent linkage.
- `session.status`, `session.list`, and `session.export` MUST include `parentSessionId`.
- Sessions without a parent MUST return `parentSessionId: null`.
