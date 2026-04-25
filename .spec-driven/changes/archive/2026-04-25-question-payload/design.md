# Design: question-payload

## Approach
1. **Types**: Introduce `QuestionPayload` to `src/session-store.ts` (or an appropriate types file) and update `Session.status` to include `"paused"`.
2. **Bridge**: Add `session.question` (server-to-client notification) and `session.resolveQuestion` (client-to-server method) to `src/bridge.ts`.
3. **Session Store**: Add logic to pause a session when a question is asked and resume it when resolved.

## Key Decisions
- **Dedicated Paused State**: Rather than keeping the session `active` and blocking the event loop, we transition the session to `paused`. This allows the server to safely suspend processing and cleanly resume when the human responds.
- **Structured Payload**: We mandate `impact` and `recommendation` fields to enforce high-quality agent questions.

## Alternatives Considered
- **Unstructured Chat**: Rejected. The roadmap explicitly calls for a structured protocol, not a real-time chat interface.
- **Synchronous Blocking**: Rejected. Blocking the thread or keeping the HTTP request open indefinitely is fragile and doesn't scale to asynchronous multi-channel delivery.
