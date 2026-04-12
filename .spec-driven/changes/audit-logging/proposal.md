# audit-logging

## What

Add a comprehensive execution audit trail that records all agent state transitions, tool executions, hook invocations, and session lifecycle events to a dedicated append-only audit log. The bridge exposes a `audit.query` JSON-RPC method for retrieving filtered audit entries, and emits `bridge/audit_event` notifications in real time as audit entries are written.

## Why

Milestone 07 (Agent Lifecycle Deep Management) targets production-grade agent orchestration. The existing structured logging (`observability/structured-logging.md`) covers general bridge operational events at configurable log levels, but it is not designed as an immutable audit trail. Audit logging serves distinct purposes:

- **Compliance and accountability**: Enterprise deployments require tamper-evident records of every agent action, state change, and tool invocation.
- **Security forensics**: When a tool executes or a permission decision is made, operators need an immutable record of what happened, when, and who triggered it.
- **Debugging complex workflows**: Multi-agent orchestration (milestone 04) and parent-child sessions create event flows that are difficult to reconstruct from general-purpose logs alone.
- **Foundation for future features**: `pause-resume` and `timeout-cancellation` (remaining milestone 07 items) both depend on an audit trail to record checkpoint and cancellation events. Milestone 09 (permissions-hooks) will integrate permission decisions into this audit trail.

The existing `session.history` provides per-session event logs but is scoped to individual session conversation flow, not cross-session audit events like state transitions, hook results, and permission decisions.

## Scope

### In Scope

- **Audit entry format**: Structured audit event schema with `eventId`, `timestamp`, `sessionId`, `eventType`, `category`, `payload`, and `metadata` fields
- **State transition auditing**: Every `AgentStateMachine` transition recorded as an audit entry (leveraging existing `StateTransitionEvent` from `src/agent-state-machine.ts`)
- **Tool execution auditing**: Tool use invocations and their results captured as audit entries (tool name, input hash, result status, duration)
- **Hook execution auditing**: Hook trigger, command, exit code, stdout/stderr, and duration captured as audit entries (extending existing `bridge/hook_triggered` notification data)
- **Session lifecycle auditing**: Session create, resume, stop, branch, spawn, and status changes recorded as audit entries
- **Audit storage**: Append-only log file per session (or unified log) stored alongside session persistence, with configurable retention
- **`audit.query` method**: JSON-RPC method to retrieve audit entries with filters (`sessionId`, `category`, `eventType`, `since`, `until`, `limit`)
- **`bridge/audit_event` notification**: Real-time notification emitted for each audit entry written
- **Integration points**: Audit writer wired into `SessionStore`, `AgentStateMachine`, hook execution path in `BridgeServer`, and tool use/result handling in `_runQuery`

### Out of Scope

- Distributed audit aggregation across multiple bridge instances
- Tamper-proof cryptographic signing of audit entries (deferred to security-focused milestones)
- External SIEM or log shipping integration (can be built on top of `audit.query`)
- Audit log rotation and archival policies beyond basic retention config
- Performance-sensitive high-throughput scenarios (>1000 entries/sec)

## Unchanged Behavior

- Existing `session.start`, `session.resume`, `session.stop`, `session.spawn`, `session.branch` methods retain their current request/response contracts — audit logging is a side effect, not a behavioral change
- Existing `bridge/session_event` and `bridge/hook_triggered` notifications continue to emit with unchanged payloads
- Existing `session.history` continues to return conversation-level history entries; audit entries are a separate concern
- Existing structured logging to stderr continues unchanged; audit log is a separate output channel
- Agent execution flow, hook blocking/non-blocking semantics, and permission approval workflow remain unchanged
