# multi-agent-orchestration Tasks

## Implementation
- [x] Add `parentSessionId?: string` to `SessionConfig` type and session metadata models.
- [x] Implement `session.spawn` JSON-RPC method in the bridge handler that accepts a `parentSessionId` parameter.
- [x] Update `SessionStore` to track child sessions and cascade `session.stop` to all active children recursively.
- [x] Update `SessionStore` to propagate `bridge/subagent_event` to parent sessions when a child session completes or emits messages.
- [x] Enhance `session.list` method with optional `parentSessionId` filtering capability.
- [x] Update `@ai-spec-sdk/client` (TypeScript SDK) to include `spawn` method and `parentSessionId` on list options.
- [x] Update `ai-spec-sdk` (Python SDK) to include `spawn` method and `parentSessionId` on list options.

## Testing
- [x] Add unit test for `session.spawn` behavior ensuring a child session inherits or receives configuration correctly.
- [x] Add unit test validating that `session.stop` cascades correctly to child sessions.
- [x] Add unit test ensuring that `session.list` correctly filters by `parentSessionId`.
- [x] Run `npm run lint` or equivalent formatting check command.
- [x] Run unit tests to verify the change (`bun run test` or `npm test`).

## Verification
- [x] Verify that a `bridge/subagent_event` notification is correctly dispatched to parent subscribers when the child completes.
- [x] Verify that Python and TypeScript client implementations function correctly for `spawn` requests.
