# Tasks: response-correlation

## Implementation
- [x] Add `session.answerQuestion` method to JSON-RPC bridge definition
- [x] Implement validation logic in `SessionStore` or `AgentStateMachine` to ensure session is `waiting_for_input`
- [x] Implement correlation logic matching `requestId`
- [x] Store the accepted answer in the session state

## Testing
- [x] Run `bun run lint` to ensure type safety and code quality
- [x] Run `bun test` to execute unit tests verifying answer validation and correlation

## Verification
- [x] Verify implementation matches proposal scope by testing the complete JSON-RPC answer flow
