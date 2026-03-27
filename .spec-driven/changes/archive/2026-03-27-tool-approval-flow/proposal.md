# tool-approval-flow

## What
Add a `permissionMode: "approve"` option that routes every tool-use decision to the GUI via a new `bridge/tool_approval_requested` notification and two new JSON-RPC methods (`session.approveTool`, `session.rejectTool`), letting the GUI display a confirmation dialog before each tool executes.

## Why
TODO item 10. When `permissionMode` is `"bypassPermissions"` (the current default) the GUI has no opportunity to gate tool execution. Implementing an explicit approval mode gives GUI consumers full control over which tools run, without requiring a TTY or the built-in Claude Code permission prompts.

## Scope

**In scope**
- New `permissionMode` value `"approve"` accepted by `session.start` and `session.resume`
- `bridge/tool_approval_requested` notification sent whenever the SDK invokes `canUseTool` during an `"approve"` session
- `session.approveTool` method — resolves a pending approval as allowed
- `session.rejectTool` method — resolves a pending approval as denied
- Cleanup: all pending approvals are auto-denied when `session.stop` is called or the AbortSignal fires
- `bridge.capabilities` `methods` updated to include `session.approveTool` and `session.rejectTool`

**Out of scope**
- Approval persistence (approvals are in-memory, not stored to disk)
- "Always allow" / `updatedPermissions` propagation (accepting the approval as a one-time allow only)
- Changing default `permissionMode` (still `"bypassPermissions"`)
- Any UI — this is the bridge-side contract only

## Unchanged Behavior

- Sessions with `permissionMode: "bypassPermissions"`, `"acceptEdits"`, or `"default"` behave exactly as before — no `canUseTool` callback is wired, no approval events are emitted
- All existing methods, session state, history, and event buffering are unaffected
- The `pendingApprovals` map is entirely in-memory; no persistence file changes
