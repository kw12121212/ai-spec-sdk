# Design: approval-chains

## Approach
1.  **Policy Extensions:** Update `PolicyResult` to include `"approval_required"`. When a policy returns this, `PolicyChain` will halt and yield a similar result.
2.  **Approval Store:** Create an `ApprovalStore` class to hold pending approval objects. Each object will contain the `approvalId`, `sessionId`, `toolName`, `toolInput`, and a Promise resolver/rejecter pair to pause the tool execution workflow.
3.  **Bridge API:** Expose `bridge.approveTool(approvalId)` and `bridge.denyTool(approvalId)` JSON-RPC methods. These methods will interact with the `ApprovalStore` to resolve or reject the pending Promise.
4.  **Agent Integration:** Modify the agent runner or tool execution hook to handle the `"approval_required"` result by creating an entry in the `ApprovalStore`, pausing execution via the Promise, and returning a specific structure or throwing a specific error that the bridge can translate into a `"pending_approval"` response to the client.

## Key Decisions
-   **Bridge Protocol Representation:** We will return a specific JSON-RPC response (e.g., `status: "pending_approval"`, `approvalId: "..."`) from the tool call rather than a notification event. This aligns better with the synchronous request/response model of tool execution from the client's perspective.
-   **Storage for Pending Approvals:** Introduce an in-memory `ApprovalStore` to track pending approvals by ID. This is simple and effective for a single-node setup and can be abstracted later for persistence if needed.
-   **Approval Resolution Mechanism:** Add new JSON-RPC methods like `bridge.approveTool(approvalId)` and `bridge.denyTool(approvalId)`. This provides a clear and direct API for clients to provide authorization.

## Alternatives Considered
-   **Notification Event for Approvals:** Considered emitting a specific notification event over the transport when an approval is required. Decided against this because it decouples the request from the pending state, making client-side tracking more complex. Returning a specific response to the original tool execution request is more direct.
-   **Persistent Storage for Approvals:** Considered using a persistent database for `ApprovalStore` immediately. Decided to start with an in-memory implementation to align with the current architecture and keep the scope manageable. Persistence can be added later as part of a broader persistence strategy.
