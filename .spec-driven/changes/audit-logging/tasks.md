# Tasks: audit-logging

## Implementation

- [ ] Create `src/audit-log.ts` with `AuditEntry` interface, `AuditLog` class (constructor accepting `auditDir` and `notify` callback), `write(entry)` method (append JSONL + emit notification), and `query(filters)` method (read/filter/paginate audit files)
- [ ] Add `auditDir` parameter to `BridgeServerOptions` and construct `AuditLog` instance in `BridgeServer` constructor, defaulting to `<sessionsDir>/audit/`
- [ ] Wire `AuditLog` into `SessionStore` constructor — accept optional `AuditLog`, write `session_created` entries in `create()`, write `state_transition` entries in `transitionExecutionState()` via `AgentStateMachine.onTransition` listener
- [ ] Add audit entry writes in `_runQuery` for `tool_use` content blocks (with SHA-256 input hash) and `tool_result` content blocks (with status and duration)
- [ ] Add audit entry writes in hook execution path in `bridge.ts` — write `hook_execution` entry alongside existing `bridge/hook_triggered` notification emission
- [ ] Add lifecycle audit entries in `startSession`, `resumeSession`, `stopSession`, `spawnSession`, `branchSession` methods after each operation completes
- [ ] Implement `audit.query` JSON-RPC method handler in `BridgeServer` with filter parsing, file reading, and paginated response
- [ ] Implement audit retention cleanup on bridge startup — scan audit dir, remove expired files for non-active sessions, respect `AI_SPEC_SDK_AUDIT_RETENTION_DAYS` env var (default 30)
- [ ] Export `AuditLog` and `AuditEntry` types from `src/index.ts`

## Testing

- [ ] Run `bun run lint` (tsc --noEmit) and confirm no type errors
- [ ] Create `test/audit-log.test.ts` — unit tests for `AuditLog` class: write creates/appends JSONL file, query filters by sessionId/category/eventType/time range, query applies limit correctly, query returns empty for unknown session, query without sessionId scans all, invalid filters handled gracefully
- [ ] Create `test/session-store-audit.test.ts` — tests that `SessionStore` writes audit entries on create and state transition when AuditLog is provided, works normally when AuditLog is absent
- [ ] Create `test/bridge-audit.test.ts` — integration tests for `audit.query` method via BridgeServer: filtered queries return correct entries, limit enforcement, time range filtering, unknown session returns empty
- [ ] Create `test/hook-audit.test.ts` — tests that hook execution produces audit entries matching hook_triggered notification data, non-blocking hooks produce pending + completion entries
- [ ] Verify all new tests pass with `bun run test`

## Verification

- [ ] Verify all delta spec requirements have corresponding test scenarios
- [ ] Verify `audit.query` method is registered in the bridge method dispatch table
- [ ] Verify `bridge/audit_event` notifications are emitted for all audited event types
- [ ] Verify existing session/hook/tool methods still work unchanged (regression check)
- [ ] Verify audit files are created in correct directory structure
- [ ] Verify retention cleanup removes only eligible files
