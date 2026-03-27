---
targets: bridge/json-rpc-stdio.md, session/agent-sessions.md
---

## ADDED Requirements

### Requirement: Tool Approval Mode
When a session is started or resumed with `permissionMode: "approve"`, the bridge MUST intercept every tool-use decision and route it to the caller before execution proceeds.

The bridge MUST emit a `bridge/tool_approval_requested` notification containing:
- `sessionId` (string)
- `requestId` (string, unique per tool call)
- `toolName` (string)
- `input` (object, the tool's input arguments)
- `title` (string, optional — human-readable prompt from the SDK)
- `displayName` (string, optional — short label for the tool action)
- `description` (string, optional — additional context from the SDK)

Agent execution MUST be suspended until the caller responds via `session.approveTool` or `session.rejectTool`.

#### Scenario: Tool call is approved
- GIVEN a session is running with `permissionMode: "approve"` and Claude wants to use a tool
- WHEN the bridge emits `bridge/tool_approval_requested` and the caller calls `session.approveTool`
- THEN the tool executes and the session continues normally

#### Scenario: Tool call is rejected
- GIVEN a session is running with `permissionMode: "approve"` and Claude wants to use a tool
- WHEN the bridge emits `bridge/tool_approval_requested` and the caller calls `session.rejectTool`
- THEN the tool is not executed and Claude receives a denial message

### Requirement: session.approveTool
The bridge MUST expose a `session.approveTool` method.

Parameters: `{ sessionId: string, requestId: string }`.

If `requestId` is not found, the bridge MUST return error code `-32020`.
If `sessionId` does not match the session that owns `requestId`, the bridge MUST return error code `-32020`.

On success the pending tool call is allowed to proceed.

### Requirement: session.rejectTool
The bridge MUST expose a `session.rejectTool` method.

Parameters: `{ sessionId: string, requestId: string, message?: string }`.

Same validation as `session.approveTool`. On success the pending tool call is denied; the optional `message` string is forwarded to the agent as the denial reason.

### Requirement: Approval Cleanup on Stop
When `session.stop` is called while approvals are pending, the bridge MUST automatically deny all pending approvals for that session so the agent is not left suspended indefinitely.
