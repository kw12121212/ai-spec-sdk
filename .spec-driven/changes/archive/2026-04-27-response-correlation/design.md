# Design: response-correlation

## Approach
1. **JSON-RPC Method:** Expose a `session.answerQuestion` method taking `sessionId`, `requestId`, and the `answer` (string or object).
2. **State Validation:** The `SessionStore` or `AgentStateMachine` will verify the session's `executionState` is `waiting_for_input`.
3. **Correlation:** The provided `requestId` will be checked against the pending question's ID.
4. **Resolution:** If valid, the answer is recorded in the session context, and the session state transitions appropriately to allow resumption.

## Key Decisions
- **Protocol:** Start with JSON-RPC for answers. HTTP webhook endpoints for answers can be added later if required by channel implementations.
- **Validation:** Reject answers for sessions that are no longer `waiting_for_input` (e.g., timed out or cancelled) to prevent race conditions.

## Alternatives Considered
- **Direct HTTP POST:** Creating a dedicated REST endpoint for answers. Rejected for now to maintain consistency with the JSON-RPC primary control plane.
