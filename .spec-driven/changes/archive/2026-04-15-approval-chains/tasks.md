## Implementation
- [x] Update `PolicyResult` and `ChainRunResult` types in `src/permission-policy.ts` to include `approval_required`.
- [x] Create `src/approval-store.ts` with an `ApprovalStore` class to manage pending approvals (in-memory map of `approvalId` to `PendingApproval` objects containing promise resolvers).
- [x] Update `PolicyChain.run` in `src/permission-policy.ts` to return `approval_required` early.
- [x] Add `approveTool(approvalId)` and `denyTool(approvalId)` JSON-RPC methods to `src/bridge.ts`.
- [x] Update `executeTool` in `src/bridge.ts` (or the agent runner) to handle `approval_required` from the policy chain: generate an ID, store the pending execution in `ApprovalStore`, and return `{ status: "pending_approval", approvalId }` to the client.
- [x] Ensure `approveTool` resolves the stored promise and `denyTool` rejects it (or resolves it with a specific denial result) to resume execution.

## Testing
- [x] Run `npm run lint` or equivalent (e.g., `bun run lint` if configured) to ensure no style regressions.
- [x] Add unit tests in `test/permission-policy.test.ts` for the `approval_required` chain logic.
- [x] Create `test/approval-store.test.ts` to verify the basic storage and retrieval of pending approvals.
- [x] Update `test/bridge.test.ts` (or create a new integration test) to verify the full flow: request tool -> get pending -> call approve -> tool executes.
- [x] Run `bun test` to verify all tests pass.

## Verification
- [x] Verify that a tool execution can be paused and successfully resumed via the bridge API.
- [x] Verify that an unapproved tool execution (denied or timed out if implemented) does not run.
