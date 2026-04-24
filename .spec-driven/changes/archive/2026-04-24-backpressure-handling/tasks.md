# Tasks: backpressure-handling

## Implementation
- [x] Implement transport buffer monitoring in `src/bridge.ts` (e.g., checking WebSocket `bufferedAmount`).
- [x] Update `src/session-store.ts` and `src/llm-provider/adapters/anthropic.ts` to support pausing/delaying the async iterator when backpressure is requested.
- [x] Implement hard disconnect logic in `src/bridge.ts` if the critical buffer limit is exceeded.

## Testing

- [x] Run `npm run lint` — validate no syntax errors or unused variables.
- [x] Run `npm run test` — add unit tests in `test/session.test.ts` to mock a slow consumer and verify the async iterator is paused.
- [x] Run `npm run test` — add unit tests in `test/bridge.test.ts` to verify the hard disconnect triggers when the critical limit is exceeded.

## Verification
- [x] Verify implementation matches proposal scope
