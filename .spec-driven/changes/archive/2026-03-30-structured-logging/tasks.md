# Tasks: structured-logging

## Implementation

- [x] Create `src/logger.ts`: level enum, JSON formatting, stderr output, `child()` method, `AI_SPEC_SDK_LOG_LEVEL` env var support
- [x] Add `logger` option to `BridgeServer` constructor (optional, defaults to singleton)
- [x] Integrate logger into `bridge.ts` dispatch: log method name, duration, error on each `handleMessage`
- [x] Integrate logger into `session-store.ts`: log session create, complete, stop, interrupt events
- [x] Integrate logger into `claude-agent-runner.ts`: log query start, stop, error
- [x] Integrate logger into `mcp-store.ts`: log server start, stop, error lifecycle
- [x] Integrate logger into `workflow.ts`: log workflow execution start, result, error
- [x] Integrate logger into `config-store.ts`, `context-store.ts`, `hooks-store.ts`, `workspace-store.ts`: log write ops and errors
- [x] Implement `bridge.setLogLevel` JSON-RPC method with level validation
- [x] Add `bridge.setLogLevel` to `bridge.capabilities` response

## Testing

- [x] Lint passes (`bun run lint`)
- [x] Unit tests: logger level filtering, JSON format, child context propagation
- [x] Unit tests: `bridge.setLogLevel` validation (valid level, invalid level)
- [x] Unit tests: dispatch logging (verify method + duration + error appear in captured logs)

## Verification

- [x] Verify implementation matches proposal scope
- [x] Verify no `console.*` calls introduced anywhere in `src/`
