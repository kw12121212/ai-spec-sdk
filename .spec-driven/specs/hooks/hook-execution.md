---
mapping:
  implementation:
    - src/hooks-store.ts
    - src/bridge.ts
  tests:
    - test/hooks-store.test.ts
    - test/hook-execution.test.ts
    - test/hook-audit.test.ts
---

# Hook Execution

## Requirement: Hook Command Execution
When a hook event fires and matching hooks are registered, the bridge MUST execute each hook's `command` as a child process in the session's workspace directory.

#### Scenario: pre_tool_use hook executes before tool use
- GIVEN a `pre_tool_use` hook is registered with command `echo "tool check"`
- WHEN the agent attempts to use a tool
- THEN the hook command executes in the workspace directory
- AND the tool use proceeds only after the hook exits with code 0

#### Scenario: pre_tool_use hook blocks tool use on non-zero exit
- GIVEN a `pre_tool_use` hook is registered with command `exit 1`
- WHEN the agent attempts to use a tool
- THEN the hook command executes
- AND the tool use is aborted
- AND the agent receives an error result indicating the tool use was blocked by a hook

#### Scenario: post_tool_use hook fires without blocking
- GIVEN a `post_tool_use` hook is registered
- WHEN a tool result is received
- THEN the hook command executes asynchronously
- AND the agent execution continues without waiting for the hook to complete

#### Scenario: notification, stop, subagent_stop hooks fire without blocking
- GIVEN hooks are registered for `notification`, `stop`, or `subagent_stop` events
- WHEN the corresponding event fires
- THEN the hook commands execute asynchronously
- AND the event flow is not delayed

### Requirement: Hook Execution Result in Notification
The `bridge/hook_triggered` notification MUST include the hook execution result when the command has completed.

The notification params MUST include:
- `sessionId`: string
- `hookId`: string
- `event`: string
- `command`: string
- `matcher`: string (if set)
- `exitCode`: number | null
- `stdout`: string (truncated to 4096 bytes)
- `stderr`: string (truncated to 4096 bytes)
- `durationMs`: number
- `timedOut`: boolean

For non-blocking hooks, the notification MAY be emitted before the command completes, in which case `exitCode`, `stdout`, `stderr`, and `durationMs` MUST be `null` and `timedOut` MUST be `false`.

#### Scenario: blocking hook result included in notification
- GIVEN a `pre_tool_use` hook executes and exits with code 0 after 500ms
- WHEN the `bridge/hook_triggered` notification is emitted
- THEN `exitCode` is `0`, `durationMs` is approximately 500, and `timedOut` is `false`

#### Scenario: blocking hook timeout
- GIVEN a `pre_tool_use` hook command runs longer than the timeout (30s)
- WHEN the timeout fires
- THEN the process is killed
- AND the notification includes `exitCode: null`, `timedOut: true`

#### Scenario: non-blocking hook emits pending notification
- GIVEN a `post_tool_use` hook is registered
- WHEN the event fires
- THEN the `bridge/hook_triggered` notification is emitted immediately with `exitCode: null` and `timedOut: false`

### Requirement: Hook Execution Timeout
Hook commands MUST have a default execution timeout of 30 seconds. If the command does not complete within this timeout, the process MUST be killed.

#### Scenario: hook command times out
- GIVEN a hook command that sleeps for 60 seconds
- WHEN the hook is executed
- THEN the process is killed after 30 seconds
- AND the notification reports `timedOut: true`

### Requirement: Multiple Blocking Hooks Execute Sequentially
When multiple `pre_tool_use` hooks match a tool use event, they MUST execute sequentially in the order returned by `findMatching` (project hooks before user hooks). If any hook exits non-zero, subsequent hooks MUST NOT execute and the tool use MUST be aborted.

#### Scenario: sequential hook execution
- GIVEN two `pre_tool_use` hooks are registered for the same tool
- WHEN the tool use event fires
- THEN the first hook executes and completes
- THEN the second hook executes and completes
- AND both hook results are included in their respective notifications

#### Scenario: first hook blocks, second does not run
- GIVEN two `pre_tool_use` hooks are registered
- AND the first hook exits with code 1
- WHEN the tool use event fires
- THEN the first hook executes
- AND the second hook does NOT execute
- AND the tool use is aborted

## Requirement: Hook Execution Audit Trail

In addition to emitting `bridge/hook_triggered` notifications, the bridge MUST write a `hook_execution` audit entry via the `AuditLog` instance for every hook command execution.

The audit entry MUST be written regardless of whether the hook is blocking or non-blocking. For blocking hooks, the entry is written after the command completes (with final exitCode, stdout, stderr, durationMs). For non-blocking hooks, two entries are written: one immediate entry with pending values (exitCode null, durationMs null) and one completion entry with final values.

The audit entry payload MUST include all fields from the `bridge/hook_triggered` notification plus the `hookId` and `matcher` if available.

#### Scenario: Hook audit entry mirrors hook_triggered notification
- GIVEN a pre_tool_use hook executes and exits with code 0
- WHEN the hook completes
- THEN both a bridge/hook_triggered notification AND a hook_execution audit entry are produced
- AND both contain matching exitCode, durationMs, and command values

#### Scenario: Non-blocking hook produces two audit entries
- GIVEN a post_tool_use hook (non-blocking) is triggered
- WHEN the event fires
- THEN an audit entry with exitCode null is written immediately
- AND a second audit entry with final exitCode is written when the hook process exits

### Requirement: Hook Registration Methods
In addition to hook execution behavior, the bridge MUST expose JSON-RPC methods for registering, removing, and listing hooks.

#### Scenario: Register a hook
- GIVEN a client calls `hooks.add` with `{ event, command, matcher?, scope, workspace? }`
- WHEN the bridge validates and stores the hook
- THEN the response includes the created hook entry with a unique `hookId`

#### Scenario: Remove a hook by ID
- GIVEN a hook exists with a specific hookId
- WHEN the client calls `hooks.remove` with `{ hookId }`
- THEN the hook is removed and `{ hookId, removed: true }` is returned

#### Scenario: List hooks for workspace
- GIVEN multiple hooks are registered for a workspace
- WHEN the client calls `hooks.list` with `{ workspace }`
- THEN the response includes `{ hooks: [...] }` with all matching hooks

#### Scenario: Invalid scope rejected
- GIVEN a client calls `hooks.add` with `scope: "global"`
- WHEN the bridge validates the request
- THEN the bridge returns a `-32602` error indicating scope must be "project" or "user"

#### Scenario: Invalid event type rejected
- GIVEN a client calls `hooks.add` with `event: "invalid_event"`
- WHEN the bridge validates the request
- THEN the bridge returns a `-32602` error indicating the event is not supported
