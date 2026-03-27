# Tasks: session-depth

## Implementation

- [x] Add `sessionsDir` option to `SessionStore` constructor; on construction, load all `*.json` files from the directory into the in-memory map
- [x] Implement atomic write-through in `SessionStore`: after every mutating method (`create`, `setSdkSessionId`, `appendEvent`, `complete`, `stop`), write the full session JSON to a temp file then rename it to `<sessionsDir>/<sessionId>.json`
- [x] Add `sessionsDir` option to `BridgeServer` and wire it through to `SessionStore`
- [x] Update `cli.ts` to resolve `~/.ai-spec-sdk/sessions/` as the default `sessionsDir` and create the directory if it does not exist before constructing `BridgeServer`
- [x] Add `session.history` dispatch case in `bridge.ts`: validate `sessionId`, `offset` (default 0), `limit` (default 50, max 200); return `{ sessionId, total, entries }`
- [x] Extend `listSessions` in `bridge.ts`: add `prompt` field to each entry (first `user_prompt` history entry truncated to 200 chars, or `null`)
- [x] Update `getCapabilities` in `capabilities.ts` to include `session.history` in the supported methods list

## Testing

- [x] Unit test: `SessionStore` with `sessionsDir` — session created in memory is written to disk; reloaded on new instance construction
- [x] Unit test: atomic write — temp file is renamed to final path (verify no partial file remains after write)
- [x] Unit test: `session.history` — returns correct `total` and `entries` slice for various `offset`/`limit` combinations
- [x] Unit test: `session.history` — `limit` > 200 is capped at 200
- [x] Unit test: `session.history` — returns `-32011` for unknown session
- [x] Unit test: `session.list` — `prompt` field contains truncated initial prompt; `null` when no user_prompt entry exists
- [x] Unit test: `bridge.capabilities` — response includes `session.history`
- [x] Lint passes (`bun run lint` or equivalent)
- [x] All existing unit tests pass unchanged

## Verification

- [x] Verify `session.history` spec scenarios are covered by tests
- [x] Verify `session.list` prompt field spec scenario is covered by tests
- [x] Verify session persistence spec scenarios are covered by tests
- [x] Verify `bridge.capabilities` spec scenario is covered by tests
- [x] Verify no existing RPC method response shapes are broken
