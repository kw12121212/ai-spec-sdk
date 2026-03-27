# Design: agent-session-sdk-wiring

## Approach

**cwd wiring**: `bridge.ts` already resolves and validates `workspace` in `startSession`. The resolved path is passed into `_runQuery` as a new `cwd` parameter and forwarded to `runClaudeQuery`, which includes it as `cwd` in the SDK `query()` options. `resumeSession` reads `cwd` from the stored session record.

**SDK session_id capture**: `runClaudeQuery` emits every SDK event via `onEvent`. The bridge's `_runQuery` inspects incoming events for `{ type: "system", subtype: "init", session_id: string }` and calls a new `SessionStore.setSdkSessionId(sessionId, sdkSessionId)` method. This happens before the query completes, so by the time `session.resume` is called the ID is already stored.

**Correct resume**: `resumeSession` reads `session.sdkSessionId` from the store and passes `resume: session.sdkSessionId` to the SDK options instead of the current `resume: session.id`.

**Proxy parameter**: `session.start` and `session.resume` accept an optional `proxy` object:
```json
{ "http": "http://proxy.corp.com:8080", "https": "http://proxy.corp.com:8080", "noProxy": "localhost,127.0.0.1" }
```
`bridge.ts` validates the shape, then builds a partial env object `{ HTTP_PROXY, HTTPS_PROXY, NO_PROXY }` (omitting keys whose values are absent). This is merged with any existing `options.env` and passed to `runClaudeQuery` as the `env` option. The SDK forwards `env` to the Claude Code process, so it picks up the proxy.

**`cwd` guard**: Before running, `startSession` and `resumeSession` check if `params.options` contains a `cwd` key and throw `-32602` if so.

## Key Decisions

- **`proxy` as top-level param, not inside `options`**: Keeps the bridge contract explicit and makes it easy to validate proxy fields separately from pass-through SDK options.
- **Merge, not replace, `env`**: Caller-provided `options.env` (if any) is spread first, then proxy entries overwrite matching keys. This preserves any other env vars the caller needs while ensuring proxy settings take effect.
- **`sdkSessionId` is nullable**: A session created before this change, or a session whose `system/init` event never arrived, has `sdkSessionId: null`. Attempting to resume such a session throws `-32012 "Session SDK ID not available"`.
- **Only translate to standard env vars**: `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` are the de-facto standard accepted by Node.js HTTP clients and Claude Code's underlying fetch. No custom flag or field is needed.

## Alternatives Considered

- **Forward bridge process `process.env` proxy vars automatically**: Rejected because callers cannot control bridge process environment in all deployment scenarios. Explicit params are verifiable and testable.
- **Accept proxy at `BridgeServer` constructor level**: Would require re-creating the server to change proxy. Per-request is more flexible and aligns with how `workspace` and `prompt` are already per-request.
- **Store SDK session_id as part of `SessionHistoryEntry`**: Rejected; the SDK session_id is metadata about the session itself, not a history event. A dedicated field on `Session` is cleaner.
