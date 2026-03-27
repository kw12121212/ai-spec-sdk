# session-depth

## What
Deepen the session layer of the SDK bridge to give GUI integrators full access to session history and make sessions survive bridge process restarts.

Concrete deliverables:
- Disk-backed `SessionStore` that writes each session as a JSON file and reloads them on startup
- New RPC method `session.history` that returns stored session events with offset/limit pagination
- `session.list` response extended with a `prompt` field (first 200 characters of the initial user prompt)

## Why
Today the bridge stores all session state in memory. A GUI that crashes, is restarted, or simply wants to show a session sidebar cannot recover any prior sessions or their conversation history. `session.history` and disk persistence together close this gap without adding external dependencies.

## Scope

### In scope
- File-based session persistence: one JSON file per session in a configurable directory (default `~/.ai-spec-sdk/sessions/`)
- Session reconstruction on `BridgeServer` startup by reading all JSON files from the sessions directory
- `session.history` RPC method with `offset` and `limit` pagination parameters
- `session.list` response includes `prompt` (first 200 characters of the initial user prompt)
- `bridge.capabilities` updated to advertise `session.history` support

### Out of scope
- Cross-bridge-instance session sharing or locking
- Full-text or metadata search across sessions
- Automatic expiry or pruning of old session files
- Any change to the event notification format or transport

## Unchanged Behavior
- All existing RPC methods (`session.start`, `session.resume`, `session.stop`, `session.status`, `session.list`) continue to work with the same request/response shapes, extended only by the new `prompt` field on `session.list`
- In-memory session access patterns are unchanged; persistence is a write-through layer on top
- The `bridge/session_event` notification schema is unchanged
