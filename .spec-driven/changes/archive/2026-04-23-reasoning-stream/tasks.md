# Tasks: reasoning-stream

## Implementation
- [x] Update JSON-RPC types or relevant interfaces to include reasoning stream events
- [x] Modify the LLM provider adapters to capture and emit reasoning tokens
- [x] Update `src/bridge.ts` and `src/session-store.ts` to forward the new reasoning stream events to connected clients

## Testing
- [x] Run `npm run lint` — lint and typecheck
- [x] Run `bun test` — run unit tests to verify reasoning stream behavior

## Verification
- [x] Verify implementation matches proposal scope by ensuring reasoning tokens are successfully isolated from standard output streams