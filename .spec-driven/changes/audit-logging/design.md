# Design: audit-logging

## Approach

Introduce an `AuditLog` class (`src/audit-log.ts`) as the central audit writer, owned by `BridgeServer` and passed to `SessionStore` for state transition capture. Audit entries are written to per-session append-only JSONL files stored in a configurable `auditDir` (defaulting to `<sessionsDir>/audit/`). The `AuditLog` class exposes a single `write(entry)` method that persists the entry and emits a `bridge/audit_event` notification via the bridge's notify callback.

### Architecture

```
BridgeServer
  ├── AuditLog (new src/audit-log.ts)
  │     ├── write(entry) → append JSONL + emit bridge/audit_event
  │     └── query(filters) → read + filter entries from disk
  ├── SessionStore
  │     └── receives auditLog reference → calls auditLog.write on state transitions
  ├── AgentStateMachine
  │     └── onTransition listener → writes state_transition audit entries
  └── _runQuery / hook execution path
        └── writes tool_use, tool_result, hook_execution audit entries
```

### Audit Entry Schema

```typescript
interface AuditEntry {
  eventId: string;        // UUID
  timestamp: string;      // ISO-8601
  sessionId: string;
  eventType: string;       // e.g. "state_transition", "tool_use", "tool_result",
                          //      "hook_execution", "session_created", "session_stopped"
  category: string;       // "lifecycle" | "execution" | "security" | "system"
  payload: Record<string, unknown>;  // event-specific data
  metadata: {
    bridgeVersion: string;
    workspace?: string;
    parentSessionId?: string;
  };
}
```

### Storage Format

- One JSONL file per session: `<auditDir>/<sessionId>.auditl`
- Each line is a single JSON-encoded `AuditEntry`
- Files are opened in append mode (`a`) for each write, then closed (no persistent file handles)
- On session cleanup, audit files are retained according to retention policy (configurable via env var `AI_SPEC_SDK_AUDIT_RETENTION_DAYS`, default 30)

### Integration Points

1. **State transitions**: Register a transition listener on each `AgentStateMachine` instance (in `SessionStore` constructor or `create()`) that writes `category: "lifecycle"` audit entries using the existing `StateTransitionEvent` data.

2. **Tool execution**: In `_runQuery`'s `onEvent` callback, detect `tool_use` and `tool_result` content blocks and write `category: "execution"` audit entries. Tool input is hashed (SHA-256) rather than stored in full to avoid logging sensitive data.

3. **Hook execution**: In the existing hook execution path (where `bridge/hook_triggered` notifications are emitted), additionally write a `category: "security"` audit entry with the full hook execution details.

4. **Session lifecycle**: In `session.start`, `session.resume`, `session.stop`, `session.spawn`, `session.branch` — after the operation completes, write a `category: "lifecycle"` audit entry recording the action and its parameters (excluding sensitive fields like prompts in full).

5. **`audit.query` method**: New JSON-RPC method on `BridgeServer` that reads audit files (or the unified log) and returns filtered/paginated results.

## Key Decisions

1. **Per-session audit files over unified log**: Per-session files align with the existing session persistence model (one file per session in `sessionsDir/`). This makes cleanup straightforward (delete alongside session), avoids cross-session locking, and simplifies the `sessionId` filter in `audit.query`. A unified log would require indexing for efficient querying.

2. **JSONL format over SQLite or binary**: JSONL is human-readable, requires no dependencies beyond Node.js built-ins, matches the existing structured logging style, and is trivially grep-able for ad-hoc forensics. Performance is adequate for the target throughput (<1000 entries/sec).

3. **Hash tool inputs instead of full storage**: Tool inputs may contain sensitive data (API keys, file contents). Storing only a SHA-256 hash of the serialized input balances audit utility with security. The original input is available in `session.history` if needed for debugging.

4. **AuditLog as separate class, not mixed into SessionStore**: Keeping audit logic separate follows SRP and allows `AuditLog` to be tested independently. `SessionStore` receives it as a constructor dependency rather than importing it directly.

5. **Notification via existing notify callback**: Reusing the same `notify` callback pattern used by `BridgeServer` for all other notifications keeps the architecture consistent. The `bridge/audit_event` notification carries the full `AuditEntry`.

6. **Append-and-close file strategy**: Opening, appending, and closing the file handle on each write avoids file descriptor leaks and is fast enough for audit volumes. A buffered writer could be added later if profiling shows I/O bottleneck.

## Alternatives Considered

1. **Unified audit log file (all sessions in one file)**: Simpler file management but requires an index for efficient `sessionId` filtering. Query performance degrades as log grows. Rejected in favor of per-session files.

2. **SQLite backend for audit storage**: Would enable complex queries (JOIN across sessions, aggregation) but adds a native dependency and complexity that exceeds current requirements. Can be introduced later under milestone 14 (persistence-cache) if query needs grow.

3. **Emitting audit entries as structured log lines only**: Would reuse existing logger infrastructure but conflates operational logs with compliance-grade audit records. Audit entries need guaranteed delivery (append-only file) independent of log level configuration. Rejected.

4. **In-memory audit buffer with periodic flush**: Reduces I/O frequency but risks losing entries on crash. Given that session persistence already writes to disk on every state change, consistent disk writes are acceptable for audit data too.
