# execution-hooks

## What

Execute registered hook commands when hook events fire, and support blocking behavior for `pre_tool_use` hooks so they can intercept, modify, or prevent tool execution before the agent proceeds.

Currently, `_fireHooks` only emits a `bridge/hook_triggered` notification. After this change, the bridge will `spawn` the hook command, capture its stdout/stderr/exit code, and — for `pre_tool_use` hooks — wait for the command to complete before allowing the tool use to proceed. If a blocking hook exits non-zero, the tool use MUST be aborted.

## Why

The hooks infrastructure already exists (`HooksStore`, `HookEntry.command`, `_fireHooks`, `hooks.add`/`hooks.remove`/`hooks.list` RPC methods) but hook commands are never executed. This makes the hook system notification-only rather than functional. Execution hooks are needed to:
- Allow external programs to observe and react to tool execution
- Enable blocking pre-flight checks (e.g., safety gates, policy enforcement)
- Provide the execution-event capture foundation that audit-logging, pause-resume, and timeout-cancellation changes depend on

## Scope

**In scope:**
- Modify `_fireHooks` in `bridge.ts` to `spawn` the hook command via `child_process.spawn`
- For `pre_tool_use` hooks: execute synchronously (await completion) before the tool use proceeds; abort the tool use if the hook exits non-zero
- For `post_tool_use`, `notification`, `stop`, `subagent_stop` hooks: execute asynchronously (fire-and-forget) so the agent is not blocked
- Capture hook execution result (exit code, stdout, stderr, duration) and include it in the `bridge/hook_triggered` notification
- Add a timeout for hook execution (default 30s) to prevent hung hooks from blocking the agent
- Update delta spec for the observable hook execution behavior

**Out of scope:**
- Hook command modification of the tool input/output payload (future enhancement)
- Hook retry logic on failure
- Hook command output streaming to the client
- Changes to the hook registration API (`hooks.add`, `hooks.remove`, `hooks.list`)

## Unchanged Behavior

- Hook registration, removal, and listing behavior MUST NOT change
- Hook file persistence (`.claude/hooks.json`) MUST NOT change
- Non-blocking hook events (`post_tool_use`, `notification`, `stop`, `subagent_stop`) MUST NOT alter the agent execution flow — they remain fire-and-forget
- The `_fireHooks` method MUST still emit `bridge/hook_triggered` notifications for all matching hooks
- When no hooks are registered, behavior MUST be identical to current (no hooks to fire)
