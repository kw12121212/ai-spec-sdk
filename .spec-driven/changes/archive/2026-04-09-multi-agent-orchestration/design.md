# multi-agent-orchestration Design

## Approach
To enable multi-agent orchestration, we augment the bridge API with a `session.spawn` JSON-RPC method that allows creating a child session linked to a parent session.
We will enhance `SessionStore` to track `parentSessionId`.
When a session is stopped via `session.stop`, `SessionStore` will fetch all child sessions recursively (or just direct children if nesting depth is constrained) and stop them to prevent orphaned sessions.
When a child session emits an event (like completion or message), the parent's subscribers will receive a `bridge/subagent_event` notification.

## Key Decisions
- **Lifecycle Cascade**: We chose to cascade the `session.stop` operation from a parent to all active child sessions automatically. This guarantees that stopping a root task stops all spawned sub-agents cleanly.
- **Event Propagation**: Instead of forcing the client to subscribe to every child's `sessionId`, the bridge will emit a special `bridge/subagent_event` notification on the parent's session stream containing the child's events or at least its completion state.
- **Session Filtering**: `session.list` will accept an optional `parentSessionId` filter to allow inspecting a specific session's sub-agents.

## Alternatives Considered
- **Orphan Child Sessions**: Alternatively, we could have left child sessions running if the parent stopped. We rejected this because it introduces risk of runaway resources and breaks the expected hierarchical lifecycle.
- **Client-Side Orchestration**: We could force the client SDK to manage the hierarchy (creating normal sessions and linking them client-side). We rejected this because it defeats the goal of "Advanced Runtime" where the bridge provides native multi-agent primitives across languages.
