---
implementation:
  - src/audit-log.ts
tests:
  - test/audit-log.test.ts
---

# Audit Logging

## Requirement: Audit Entry Schema

Every audit entry written by the bridge MUST conform to the following schema:

| Field | Type | Required | Description |
|---|---|---|---|
| `eventId` | string | yes | UUID uniquely identifying this audit entry |
| `timestamp` | string | yes | ISO-8601 timestamp of when the entry was written |
| `sessionId` | string | yes | The session ID this entry relates to |
| `eventType` | string | yes | Specific event type identifier (see Event Types below) |
| `category` | string | yes | One of `"lifecycle"`, `"execution"`, `"security"`, `"system"` |
| `payload` | object | yes | Event-specific data (shape varies by eventType) |
| `metadata.bridgeVersion` | string | yes | Bridge version at time of entry |
| `metadata.workspace` | string | no | Workspace path, when applicable |
| `metadata.parentSessionId` | string | no | Parent session ID for child sessions |

### Defined Event Types

| eventType | category | payload fields |
|---|---|---|
| `state_transition` | lifecycle | `from`, `to`, `trigger` |
| `session_created` | lifecycle | `workspace`, `parentSessionId?` |
| `session_resumed` | lifecycle | — |
| `session_stopped` | lifecycle | `reason?` |
| `session_completed` | lifecycle | — |
| `session_spawned` | lifecycle | `parentSessionId`, `childSessionId`, `workspace` |
| `session_branched` | lifecycle | `sourceSessionId`, `fromIndex?`, `newSessionId` |
| `tool_use` | execution | `toolName`, `inputHash`, `id` |
| `tool_result` | execution | `toolName`, `inputHash`, `status` (`"success"` / `"error"`), `durationMs?` |
| `hook_execution` | security | `hookId`, `event`, `command`, `exitCode`, `durationMs`, `timedOut` |

#### Scenario: Audit entry has required fields
- GIVEN an audit entry is written for any event
- WHEN the entry is read from the audit log
- THEN it contains all required fields with correct types

#### Scenario: eventId is a valid UUID
- GIVEN an audit entry is written
- WHEN the entry's eventId is inspected
- THEN it is a valid UUID v4 format

## Requirement: Audit Log Storage

The bridge MUST store audit entries as append-only JSONL files. Each session MUST have its own audit file located at `<auditDir>/<sessionId>.auditl`.

The audit directory (`auditDir`) MUST default to `<sessionsDir>/audit/` and be created automatically on first write if it does not exist.

Each line in the audit file MUST be a single JSON object (the `AuditEntry`) followed by a newline character. Lines MUST NOT contain intermediate newlines within the JSON.

#### Scenario: Audit file created on first entry
- GIVEN a session with ID "abc-123" exists
- WHEN the first audit entry is written for that session
- THEN a file `<auditDir>/abc-123.auditl` is created containing exactly one JSON line

#### Scenario: Entries are appended, not overwritten
- GIVEN an audit file already contains 3 entries
- WHEN a 4th entry is written for the same session
- THEN the file now contains 4 lines, with the original 3 lines unchanged

#### Scenario: Audit directory auto-created
- GIVEN the audit directory does not exist
- WHEN the first audit entry is written for any event
- THEN the directory is created (including any missing parent directories)

## Requirement: State Transition Auditing

Every state transition performed by the `AgentStateMachine` MUST be recorded as an audit entry with `eventType: "state_transition"` and `category: "lifecycle"`.

The payload MUST include:
- `from`: the previous execution state
- `to`: the new execution state
- `trigger`: the trigger string passed to the transition method

This MUST be implemented via a transition listener registered on each `AgentStateMachine` instance.

#### Scenario: State transition creates audit entry
- GIVEN an active session transitions from "idle" to "running" with trigger "query_started"
- WHEN the transition completes
- THEN an audit entry exists with eventType "state_transition", payload.from "idle", payload.to "running", and payload.trigger "query_started"

#### Scenario: Invalid transition produces no audit entry
- GIVEN a transition is attempted that is not in the valid transitions set
- WHEN the transition fails
- THEN no audit entry is written for that attempted transition

## Requirement: Tool Execution Auditing

When the agent invokes a tool during query execution, the bridge MUST write an audit entry with `eventType: "tool_use"` and `category: "execution"` before the tool executes.

When the tool result is received, the bridge MUST write an audit entry with `eventType: "tool_result"` and `category: "execution"`.

The `tool_use` payload MUST include:
- `toolName`: name of the invoked tool
- `inputHash`: SHA-256 hex digest of the serialized tool input
- `id`: the tool use block identifier from the SDK message

The `tool_result` payload MUST include:
- `toolName`: name of the tool
- `inputHash`: matching SHA-256 hex digest from the corresponding `tool_use`
- `status`: `"success"` or `"error"`
- `durationMs`: elapsed milliseconds between tool_use and tool_result (when measurable)

#### Scenario: Tool use is audited before execution
- GIVEN an agent invokes the "Read" tool during a session
- WHEN the tool use content block is processed
- THEN an audit entry with eventType "tool_use" and toolName "Read" is written
- AND the inputHash is a 64-character hex string

#### Scenario: Tool result is audited with status
- GIVEN a tool use completed successfully
- WHEN the tool result content block is processed
- THEN an audit entry with eventType "tool_result", status "success", and matching toolName is written

#### Scenario: Tool error is audited
- GIVEN a tool use results in an error
- WHEN the tool result content block is processed
- THEN an audit entry with eventType "tool_result" and status "error" is written

## Requirement: Hook Execution Auditing

When a hook command executes (regardless of blocking or non-blocking mode), the bridge MUST write an audit entry with `eventType: "hook_execution"` and `category: "security"`.

The payload MUST include:
- `hookId`: identifier of the hook that fired
- `event`: hook event type (e.g., `pre_tool_use`, `post_tool_use`)
- `command`: the shell command that was executed
- `exitCode`: process exit code, or `null` if still running (non-blocking)
- `durationMs`: execution duration in milliseconds, or `null` if still running
- `timedOut`: whether the hook was killed due to timeout

For non-blocking hooks, the initial audit entry is written with `exitCode: null`, `durationMs: null`, `timedOut: false`. A follow-up entry MUST be written when the hook completes with final values.

#### Scenario: Blocking hook execution is fully audited
- GIVEN a `pre_tool_use` hook executes and exits with code 0 after 200ms
- WHEN the hook completes
- THEN an audit entry with eventType "hook_execution", exitCode 0, durationMs ~200, timedOut false is written

#### Scenario: Non-blocking hook emits pending then completion entries
- GIVEN a `post_tool_use` hook is registered (non-blocking)
- WHEN the event fires
- THEN an initial audit entry is emitted immediately with exitCode null
- AND a second audit entry is emitted when the hook completes with final exitCode and durationMs

#### Scenario: Hook timeout is audited
- GIVEN a hook command exceeds the 30s timeout
- WHEN the timeout kills the process
- THEN an audit entry with timedOut true and exitCode null is written

## Requirement: Session Lifecycle Auditing

The bridge MUST write audit entries for the following session lifecycle events:

| Trigger | eventType | Timing |
|---|---|---|
| `session.start` succeeds | `session_created` | After session is created and stored |
| `session.resume` begins | `session_resumed` | After resume context is loaded |
| `session.stop` completes | `session_stopped` | After session is marked stopped |
| Session completes naturally | `session_completed` | When terminal state detected |
| `session.spawn` succeeds | `session_spawned` | After child session is created |
| `session.branch` succeeds | `session_branched` | After branch session is created |

All lifecycle events MUST have `category: "lifecycle"`.

The `session_created` payload MUST include `workspace`. It MAY include `parentSessionId` for child sessions.
The `session_stopped` payload MAY include `reason` (e.g., `"user_request"`, `"timeout"`, `"error"`).
The `session_spawned` payload MUST include `parentSessionId`, `childSessionId`, and `workspace`.
The `session_branched` payload MUST include `sourceSessionId` and `newSessionId`. It MAY include `fromIndex`.

#### Scenario: Session start creates audit entry
- GIVEN a client calls `session.start` with workspace "/tmp/project"
- WHEN the session is created successfully
- THEN an audit entry with eventType "session_created" and payload.workspace "/tmp/project" exists

#### Scenario: Session stop creates audit entry with reason
- GIVEN a client calls `session.stop` for an active session
- WHEN the session is marked stopped
- THEN an audit entry with eventType "session_stopped" exists

#### Scenario: Session spawn records parent-child linkage
- GIVEN a parent session spawns a child session
- WHEN the spawn completes
- THEN an audit entry with eventType "session_spawned" includes both parentSessionId and childSessionId

## Requirement: Audit Event Notification

Whenever an audit entry is written, the bridge MUST emit a `bridge/audit_event` notification containing the complete `AuditEntry` as the notification params.

#### Scenario: Notification carries full audit entry
- GIVEN an audit entry is written for any event
- WHEN the entry is persisted
- THEN a `bridge/audit_event` notification is emitted with params equal to the full AuditEntry object

## Requirement: Audit Retention Policy

The bridge MUST respect the `AI_SPEC_SDK_AUDIT_RETENTION_DAYS` environment variable for audit file retention. When not set, the default retention period MUST be 30 days.

On bridge startup, the bridge MUST scan the audit directory and remove audit files older than the retention period whose corresponding sessions no longer exist (or regardless of session existence, depending on policy).

Audit files for active sessions MUST never be deleted regardless of age.

#### Scenario: Expired audit files are cleaned on startup
- GIVEN audit files exist that are older than the retention period
- AND their sessions no longer exist (or are not active)
- WHEN the bridge starts
- THEN those audit files are deleted

#### Scenario: Active session audit files are preserved
- GIVEN an active session has an audit file older than the retention period
- WHEN the bridge starts and runs cleanup
- THEN that audit file is NOT deleted
