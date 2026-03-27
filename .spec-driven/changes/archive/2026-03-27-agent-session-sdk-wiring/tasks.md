# Tasks: agent-session-sdk-wiring

## Implementation

- [x] `session-store.ts`: add `sdkSessionId: string | null` field to `Session`; add `setSdkSessionId(sessionId, sdkSessionId)` method
- [x] `claude-agent-runner.ts`: add `cwd` and `env` fields to `RunClaudeQueryOptions`; pass both to `query()` options
- [x] `bridge.ts` `_runQuery`: accept `cwd` param; detect `system/init` event and call `store.setSdkSessionId`; forward `cwd` and `env` to `runClaudeQuery`
- [x] `bridge.ts` `startSession`: pass `cwd: resolvedWorkspace`; validate no `cwd` key in `options` (throw `-32602`); validate and translate `proxy` param into env entries; merge with `options.env`
- [x] `bridge.ts` `resumeSession`: read `cwd` from stored session; reject if `sdkSessionId` is null (throw `-32012`); pass `resume: session.sdkSessionId`; apply same proxy and `cwd` guard logic
- [x] Define `ProxyParams` interface (`http?`, `https?`, `noProxy?`) and `validateProxy` helper in `bridge.ts`

## Testing

- [x] `session.test.ts`: assert that stub receives `cwd` equal to the fixture workspace path on `session.start`
- [x] `session.test.ts`: assert that `session.resume` passes `resume` equal to the SDK `session_id` from the stub's init event (not the bridge UUID)
- [x] `session.test.ts`: assert that `session.start` with a `proxy` object causes the stub to receive matching `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` in `env`
- [x] `session.test.ts`: assert that `session.start` with `options.cwd` returns a `-32602` error
- [x] `session.test.ts`: assert that `session.resume` when `sdkSessionId` is null returns a `-32012` error
- [x] `session.test.ts`: assert that a partial proxy (only `http`) only sets `HTTP_PROXY`, leaves others absent
- [x] Lint passes (`bun run lint` or equivalent)
- [x] All unit tests pass (`bun test`)

## Verification

- [x] Every item in proposal scope has a corresponding passing test
- [x] No existing tests were removed or weakened
- [x] Delta specs match what was actually built
