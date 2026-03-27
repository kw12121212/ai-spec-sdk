# Design: session-depth

## Approach

### Disk-backed SessionStore
`SessionStore` gains an optional `sessionsDir` constructor parameter. When provided:
- On construction, all `*.json` files in `sessionsDir` are loaded and populated into the in-memory map (reconstruction)
- On every mutating operation (`create`, `setSdkSessionId`, `appendEvent`, `complete`, `stop`), the affected session is written atomically to `<sessionsDir>/<sessionId>.json` (write-through)

The JSON file for each session is the full `Session` object serialized with `JSON.stringify`. This is the simplest representation and requires no migration logic for the initial implementation.

`BridgeServer` accepts a `sessionsDir` option and passes it through to `SessionStore`. The CLI (`cli.ts`) supplies the default path (`~/.ai-spec-sdk/sessions/`) and creates the directory if it does not exist.

### Atomic writes
Each session write uses a write-to-temp-then-rename pattern (`<sessionId>.json.tmp` → `<sessionId>.json`) to avoid partial reads if the process crashes mid-write.

### `session.history` RPC method
New dispatch case in `bridge.ts`:

```
Request:  { sessionId, offset?: number, limit?: number }
Response: { sessionId, total: number, entries: SessionHistoryEntry[] }
```

- `offset` defaults to 0; `limit` defaults to 50, capped at 200
- Entries are the raw `SessionHistoryEntry` objects already stored in `session.history`
- Returns `-32011` if session not found, `-32602` if params are invalid

### `session.list` prompt field
`listSessions` maps the session object and adds `prompt`: the `prompt` field from the first `user_prompt` history entry, truncated to 200 characters. If no such entry exists, `prompt` is `null`.

## Key Decisions

**One file per session, not a single store file.**
A single append-log or database would be faster to write but significantly harder to reconstruct and debug. One-file-per-session keeps each session independently readable and deletable.

**Write-through, not write-behind.**
Async batching would improve throughput but risks data loss on crash. Since sessions are already async-heavy, synchronous-on-the-same-tick writes are acceptable; the file write happens after the in-memory update in the same async call.

**No cross-instance locking.**
Two `BridgeServer` instances pointing at the same `sessionsDir` could corrupt each other's files. This is out of scope; the spec explicitly states sessions are "known to the current bridge process."

**Default storage at `~/.ai-spec-sdk/sessions/`.**
Keeps sessions out of the project workspace (no accidental commits) and co-located with other tool config conventions.

## Alternatives Considered

**SQLite via `better-sqlite3`.**
Would enable indexed queries and richer filtering. Rejected because it adds a native dependency and the current query needs (list by status, paginate by index) are satisfied by in-memory filtering over the reconstructed map.

**JSONL append-only log.**
Efficient for streaming appends but requires replaying the entire log to reconstruct state. One-file-per-session with full overwrites is simpler given that individual sessions are small.
