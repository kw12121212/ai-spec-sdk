# Design: execution-hooks

## Approach

The `_fireHooks` method in `bridge.ts` currently iterates matching hooks and emits a `bridge/hook_triggered` notification for each. This change adds command execution via `child_process.spawn` to that loop:

1. **Blocking hooks (`pre_tool_use`)**: For each matching `pre_tool_use` hook, spawn the command and await its completion before proceeding. If the hook exits with a non-zero code, the tool use is aborted and the agent receives an error result instead of the tool execution.

2. **Non-blocking hooks (all other events)**: Spawn the command without awaiting — fire-and-forget. The notification is still emitted immediately.

3. **Hook execution result capture**: The `bridge/hook_triggered` notification is extended to include `exitCode`, `stdout` (first 4KB), `stderr` (first 4KB), and `durationMs` when the hook command has completed.

4. **Timeout enforcement**: Each spawned hook process is given a configurable timeout (default 30 seconds). If exceeded, the process is killed and the notification reports `exitCode: null` with a `timedOut: true` flag.

5. **Workspace as CWD**: Hook commands execute in the session's workspace directory, ensuring consistent filesystem context.

### Execution flow for `pre_tool_use`:

```
tool_use message received
  → find matching pre_tool_use hooks
  → for each blocking hook:
      → spawn(command, { cwd: workspace, timeout: 30000 })
      → await exit
      → if exitCode !== 0: abort tool use, emit notification with error, return
  → if all hooks passed: proceed with normal tool use flow
  → emit bridge/hook_triggered notification with result
```

### Execution flow for non-blocking hooks:

```
event fires
  → find matching hooks
  → for each hook:
      → spawn(command, { cwd: workspace, timeout: 30000 })
      → attach timeout kill handler
      → do NOT await — fire-and-forget
  → emit bridge/hook_triggered notification immediately (exitCode: "pending")
```

## Key Decisions

1. **`pre_tool_use` is the only blocking event**: This is enforced by `HooksStore.isBlocking()` which already returns `true` only for `pre_tool_use`. No new event types are added as blocking.

2. **Hook failure aborts tool use**: A non-zero exit code from a `pre_tool_use` hook means the tool use is denied. This aligns with the security-gate use case (e.g., a policy check that rejects a dangerous tool invocation).

3. **stdout/stderr capped at 4KB**: To prevent unbounded notification payloads, captured output is truncated. Full output can be logged separately if needed (out of scope for this change).

4. **Default 30s timeout**: Prevents hung or misconfigured hooks from indefinitely blocking the agent. A hook timeout is treated as a failure for blocking hooks (tool use is aborted) but is non-fatal for non-blocking hooks.

5. **No payload modification yet**: Hook commands cannot currently modify the tool input or output. They can only approve (exit 0) or deny (exit non-zero) the tool use. Payload transformation is a future enhancement.

6. **Hooks execute sequentially for blocking events**: If multiple `pre_tool_use` hooks match, they execute in order (project hooks before user hooks, as returned by `findMatching`). The first non-zero exit aborts the chain.

## Alternatives Considered

1. **Promise.all for parallel hook execution**: Rejected because blocking hooks need deterministic ordering — if hook A checks policy and hook B logs, A should run first so B can log the outcome. Sequential execution ensures ordering guarantees.

2. **Hook command receives tool input via stdin**: Considered but deferred. The hook command currently receives no input beyond environment context (workspace, tool name via env vars). Passing tool input via stdin is a natural next step but is out of scope for this change.

3. **Webhook-based hooks instead of spawn**: Rejected. Webhooks are already handled separately (`webhooks.ts`) for remote notification delivery. Local hook execution via `spawn` is the correct mechanism for in-process, workspace-scoped hooks.

4. **Hook result stored in session history**: Considered but deferred. Hook results could be appended to session history as a new event type, but this couples hooks to the history system. Audit logging (a separate planned change) is the right place for execution trails.
