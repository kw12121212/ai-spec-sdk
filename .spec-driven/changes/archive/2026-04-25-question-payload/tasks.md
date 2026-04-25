# Tasks: question-payload

## Implementation
- [x] Define `QuestionPayload` interface and update session status types in `src/session-store.ts`
- [x] Implement `session.question` emission and `session.resolveQuestion` method in `src/bridge.ts`
- [x] Update session execution logic to handle the pause/resume flow when a question is asked.

## Testing
- [x] Run `npm run lint` — validation task
- [x] Run `bun test test/session-store.test.ts test/bridge.test.ts` — unit tests

## Verification
- [x] Verify implementation matches proposal scope and JSON-RPC contracts
