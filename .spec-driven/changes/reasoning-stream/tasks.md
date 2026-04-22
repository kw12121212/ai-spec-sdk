# Tasks: reasoning-stream

## Implementation
- [ ] Update JSON-RPC types or relevant interfaces to include reasoning stream events
- [ ] Modify the LLM provider adapters to capture and emit reasoning tokens
- [ ] Update `src/bridge.ts` and `src/session-store.ts` to forward the new reasoning stream events to connected clients

## Testing
- [ ] Run `npm run lint` — lint and typecheck
- [ ] Run `bun test` — run unit tests to verify reasoning stream behavior

## Verification
- [ ] Verify implementation matches proposal scope by ensuring reasoning tokens are successfully isolated from standard output streams