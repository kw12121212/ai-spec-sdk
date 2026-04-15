# Proposal: approval-chains

## What
Implement multi-level authorization workflows for sensitive operations, allowing tool executions to be paused pending human or external approval.

## Why
To achieve the "enhanced tool approval flow with multi-level authorization" goal of the `09-permissions-hooks.md` milestone. This ensures sensitive tools can be governed by a human-in-the-loop before execution, a critical requirement for enterprise-grade security.

## Scope
- Extending `PermissionPolicy` and `PolicyChain` results to include an `approval_required` state.
- Updating the bridge protocol to signal pending approvals to the client via specific JSON-RPC responses (`status: "pending_approval"`, `approvalId: "..."`).
- Introducing an in-memory `ApprovalStore` to manage the state of pending tool executions while waiting for approval.
- Providing a mechanism via new JSON-RPC methods (`bridge.approveTool`, `bridge.denyTool`) to resolve pending executions and resume the agent.

## Unchanged Behavior
- Basic allow/deny/pass policy semantics remain unchanged.
- Existing tool execution workflows for fully-allowed or fully-denied tools are unaffected.
- Session lifecycles are unchanged (except for the introduction of an approval paused state).
