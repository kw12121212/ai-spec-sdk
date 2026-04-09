# multi-agent-orchestration Proposal

## What
Introduce parent-child agent session relationships to enable multi-agent orchestration. This allows a parent session to spawn a child session and receive lifecycle events (e.g., completion) regarding the child session. If a parent session is stopped, all of its active child sessions are recursively stopped to prevent orphaned processes.

## Why
This implements the "multi-agent-orchestration" planned change under the Advanced Runtime milestone (04-advanced-runtime.md). Adding native support for `session.spawn` provides a standardized mechanism for multi-agent workflows across the bridge SDK ecosystem, fulfilling a core objective of the platform.

## Scope
- Add `session.spawn` to the bridge API, creating a child session linked to a parent `sessionId`.
- Enhance the `SessionStore` to track `parentSessionId` and propagate `bridge/subagent_event` (or similar) notifications.
- Cascade `session.stop` calls to all associated child sessions.
- Update `session.list` to support filtering by `parentSessionId`.
- Add the corresponding methods and tests to the TypeScript Client SDK and the Python Client SDK.

## Unchanged Behavior
- Existing single-agent `session.start` and `session.stop` behavior remains unchanged when not part of a hierarchy.
- WebSocket and HTTP SSE transports do not change their fundamental notification fan-out mechanisms.
- Authentication, logging, and existing tool configurations are preserved without changes.
