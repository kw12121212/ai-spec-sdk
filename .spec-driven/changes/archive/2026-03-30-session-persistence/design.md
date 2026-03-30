# Design: session-persistence

## Approach

Extend the existing `SessionStore` in-place rather than introducing a pluggable storage backend. The store already handles file I/O — the changes add recovery logic to the constructor, expose delete/export/cleanup operations, and extend the session status type.

1. **Interrupted recovery**: In `SessionStore._loadFromDisk()`, after loading each session, check if `status === "active"`. If so, set it to `"interrupted"` and persist. This runs once at startup before any client requests are served.

2. **session.export**: Return the full session object (id, workspace, sdkSessionId, status, createdAt, updatedAt, history, result) from the in-memory map. No disk re-read needed.

3. **session.delete**: Remove from the in-memory map and delete the JSON file from disk. Reject if the session is `active` (cannot delete a running session).

4. **session.cleanup**: Iterate all sessions, compute age from `updatedAt`, delete those older than the requested threshold. Returns the count of removed sessions. Active sessions are excluded from cleanup.

5. **Bridge dispatch**: Add three new cases to the switch statement in `dispatch()`, each delegating to a new method on `BridgeServer`.

6. **Contract update**: Fix the "in-memory only" statement in `bridge-contract.yaml` and document the three new methods and the `interrupted` status.

## Key Decisions

- **No pluggable storage backend**: YAGNI — there is one storage implementation (file-based) and no concrete need for another. Introducing an interface now would be speculative.
- **No debounced writes**: The current immediate-flush strategy is simple and correct. The local SDK use case does not have I/O throughput concerns.
- **Interrupted sessions cannot be auto-resumed**: The SDK session context is likely lost after a crash. `interrupted` sessions can be listed and exported but must be explicitly resumed by the client (which creates a new SDK session).
- **Active sessions cannot be deleted or cleaned up**: Prevents accidental removal of in-progress sessions.
- **Cleanup uses `updatedAt`**, not `createdAt`: Ensures recently-active sessions (even if created long ago) are not prematurely removed.

## Alternatives Considered

- **Debounced writes (500ms)**: Would reduce I/O for high-frequency event appends but adds complexity (debounce timer, flush-on-close). The local SDK rarely has enough concurrent sessions for this to matter. Rejected.
- **Pluggable storage interface**: Would enable future SQLite or remote storage backends. Adds an abstraction layer with only one implementation. Rejected per YAGNI.
- **Auto-resume interrupted sessions**: On startup, automatically resume sessions that were interrupted. Rejected because the SDK session context is lost and auto-resuming without context would start fresh conversations, which is surprising behavior.
