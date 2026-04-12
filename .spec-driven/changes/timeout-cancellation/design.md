# Design: timeout-cancellation

## Approach

### `session.cancel` RPC method
New dispatch case in `bridge.ts`:
```
Request:  { sessionId: string, reason?: string }
Response: { success: true, sessionId: string, cancelledAt: string }
```

- Verify `sessionId` exists; return `-32011` error if not
- Check session `executionState` is `"running"` or `"waiting_for_input"`; return `-32602` error if not
- If agent query is in progress, attempt to cancel it via Claude Agent SDK
- Transition `executionState` to `"completed"`
- Record `cancelledAt` timestamp and `cancelReason` (if provided)
- Write audit log entry for cancellation
- Return success response

### Timeout support on `session.start` and `session.resume`
- Add optional `timeoutMs` parameter to both methods
- Validate `timeoutMs` is ≥ 1000 (1 second); return `-32602` error if invalid
- When a timeout is set, schedule a timer that cancels the session after the duration
- The timer is cleared if the session completes normally before the timeout
- Timeout triggers the same cancellation flow as `session.cancel`, with reason `"timeout"`

### Cancellation signal propagation
- `ClaudeAgentRunner` accepts an `AbortSignal` when starting a query
- When cancellation is requested, call `abort()` on the signal
- The runner uses the signal to abort any in-progress SDK calls
- Session store is updated with cancellation status regardless of whether the SDK supports cancellation

### Session metadata updates
- Add optional fields to `Session` type:
  - `cancelledAt?: string` - ISO 8601 timestamp when cancelled
  - `cancelReason?: string` - reason for cancellation ("user_requested" or "timeout")
  - `timeoutMs?: number` - configured timeout duration (if any)
- These fields are persisted to disk and included in `session.status`, `session.list`, and `session.export`

### Audit logging
- Write `session_cancelled` audit entry (category: "lifecycle") when a session is cancelled, payload includes `reason` and `cancelledAt`
- Write `session_timed_out` audit entry (category: "lifecycle") when a timeout triggers cancellation

### Capabilities
- Update `getCapabilities` in `capabilities.ts` to include `session.cancel` in the supported methods list

## Key Decisions

**`session.cancel` is distinct from `session.stop`.**
`session.stop` terminates a session cleanly and marks it as "stopped", while `session.cancel` is for actively aborting a running query and marks it as "completed" with a cancellation reason. This preserves backward compatibility with existing `session.stop` usage patterns.

**Timeout is enforced on the bridge, not delegated to the SDK.**
The bridge owns timeout enforcement to ensure consistent behavior regardless of SDK version or capabilities. The timer is managed in the bridge and triggers the same cancellation flow as user-initiated cancellation.

**Minimum timeout of 1 second.**
Prevents accidental near-instant timeouts that don't give the agent any time to execute. Clients that want immediate cancellation should use `session.cancel` directly.

**No partial rollback.**
Cancellation stops future execution but does not undo side-effects already performed by the agent. This is consistent with how `session.stop` works and avoids complex rollback logic.

## Alternatives Considered

**Add cancellation to existing `session.stop`.**
Would avoid adding a new RPC method, but would change the semantics of `session.stop` in a breaking way. Kept them separate to preserve backward compatibility.

**Delegate timeout to Claude Agent SDK.**
Would reduce bridge complexity, but the SDK may not support timeouts consistently across versions. Bridge-controlled timeouts provide more predictable behavior.

**Support pause-and-resume for timeouts.**
Would allow resuming a timed-out session, but timeouts are intended for termination, not temporary suspension. Use `session.pause`/`resume` for that use case instead.
