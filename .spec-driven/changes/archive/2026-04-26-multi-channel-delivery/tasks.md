# Tasks: multi-channel-delivery

## Implementation
- [x] Update webhook delivery system to subscribe to `session.question` events emitted by agents
- [x] Add `session_question` to the list of webhook event types
- [x] Construct the structured payload for question webhooks
- [x] Ensure question webhooks use the existing retry and HMAC signing logic
- [x] Implement WebPush or generic push notification HTTP dispatch functionality

## Testing

- [x] Run `npm run lint` — validation task to check for TypeScript errors
- [x] Run `bun test` — unit tests to verify webhook question delivery

## Verification
- [x] Verify implementation matches proposal scope by ensuring `session_question` webhooks are delivered correctly.
