# Tasks: tool-approval-flow

## Implementation

- [x] Add `"approve"` to `PERMISSION_MODES` in `bridge.ts`; add `session.approveTool` and `session.rejectTool` to the `methods` list in `capabilities.ts`
- [x] Add `pendingApprovals` map to `BridgeServer`; implement `_buildApprovalCallback(sessionId, requestId)` helper that creates the `canUseTool` closure
- [x] Wire `canUseTool` into `_runQuery`: when `permissionMode === "approve"`, build the callback and add it to `sdkOptions` before calling the query
- [x] Add `session.approveTool` and `session.rejectTool` dispatch cases and private methods
- [x] Deny all pending approvals for a session in `stopSession`
- [x] Update `TODO.md`: mark item 10 as `[x]`

## Testing

- [x] Add unit tests for `session.approveTool` / `session.rejectTool` in `test/session.test.ts`: happy path allow, happy path deny, unknown requestId error, sessionId mismatch error
- [x] Add test for stop cleanup: pending approval is auto-denied when session.stop is called
- [x] Lint passes (`bun run typecheck`)
- [x] Unit tests pass (`bun test`)

## Verification

- [x] Verify implementation matches proposal
