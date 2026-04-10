# Tasks: event-webhooks

## Implementation

- [x] Create `src/webhooks.ts` with WebhookManager class: subscribe/unsubscribe, HMAC-SHA256 signing, payload delivery, retry with exponential backoff
- [x] Add webhook persistence: load/save registrations to JSON file on disk
- [x] Register `webhook.subscribe` and `webhook.unsubscribe` RPC methods in bridge.ts with `admin` scope
- [x] Hook WebhookManager into session event emission (session_started, session_completed, session_stopped, session_interrupted)
- [x] Expose webhook secret in `webhook.subscribe` response for consumer-side signature verification
- [x] Add `webhook.subscribe` and `webhook.unsubscribe` to `bridge.capabilities` response

## Testing

- [x] Run `bun run typecheck` to validate TypeScript compilation
- [x] Run `bun test` — verify all existing and new tests pass
- [x] Add unit tests in `test/webhooks.test.ts`: subscribe/unsubscribe lifecycle
- [x] Add unit tests in `test/webhooks.test.ts`: HMAC-SHA256 signature generation and verification
- [x] Add unit tests in `test/webhooks.test.ts`: retry logic with backoff
- [x] Add unit tests in `test/webhooks.test.ts`: persistence across restart simulation
- [x] Add unit tests in `test/webhooks.test.ts`: unsubscribe stops delivery
- [x] Add HTTP integration tests in `test/webhooks.test.ts`: webhook RPC method auth and scope enforcement

## Verification

- [x] Verify implementation matches proposal scope
- [x] Verify existing tests (auth, rate limiting, metrics, SSE) remain green
- [x] Verify no external dependencies added
