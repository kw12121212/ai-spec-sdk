# Tasks: token-attribution

## Implementation
- [x] Add `getMessageUsage(sessionId: string, messageId: string): TokenRecord | undefined` to `TokenStore` interface and its implementation.
- [x] Ensure `claude-agent-runner.ts` passes down `messageId` into `TokenStore.recordUsage` when handling query responses.
- [x] Expose `token.getMessageUsage` over the JSON-RPC bridge in `bridge.ts` and handle the "Message not found" error (-32052) correctly.
- [x] Add `token.getMessageUsage` to `bridge.capabilities`.

## Testing
- [x] Run `bun run lint` to ensure TypeScript compilation and typechecks pass.
- [x] Run `bun test` to execute unit tests against the new message-level attribution logic and bridge methods.

## Verification
- [x] Verify implementation matches proposal scope
