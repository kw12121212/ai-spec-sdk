# timeout-cancellation

## What

Add execution timeout and cancellation support to agent sessions, completing the Agent Lifecycle Deep Management milestone.

Concrete deliverables:
- New RPC method `session.cancel` to terminate an actively executing session
- Optional `timeoutMs` parameter on `session.start` and `session.resume` to automatically terminate sessions after a duration
- Timeout and cancellation audit logging
- Graceful propagation of cancellation signals to running agent operations
- Session status transitions for timed-out and cancelled sessions

## Why

Production-grade agent orchestration requires control over execution duration and the ability to terminate misbehaving or unwanted agent runs. Without timeout and cancellation, long-running or stuck agents can consume resources indefinitely. This completes the agent lifecycle story started in the 07-agent-lifecycle milestone.

## Scope

### In scope
- `session.cancel` RPC method that stops an actively running session
- `timeoutMs` optional parameter on `session.start` and `session.resume` (minimum 1 second)
- Automatic timeout enforcement that cancels sessions when the duration is exceeded
- Audit log entries for cancellation and timeout events
- Correct state transitions from "running" to "completed" with appropriate reason
- `bridge.capabilities` updated to advertise `session.cancel` support
- Session metadata includes cancellation/timeout reason when applicable

### Out of scope
- Pausing mid-execution and resuming later (already handled by `session.pause`/`resume`)
- Distributed cancellation across multiple bridge instances
- Partial rollback of agent side-effects
- Configurable timeout defaults at the bridge level

## Unchanged Behavior
- All existing RPC methods continue to work with the same request/response shapes
- `session.stop` behavior remains unchanged (cancellation is a distinct operation for actively running queries)
- Audit logging infrastructure is reused without modification
- Session persistence format is unchanged (adds optional fields only)
