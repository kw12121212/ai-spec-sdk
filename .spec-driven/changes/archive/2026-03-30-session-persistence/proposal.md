# session-persistence

## What

Complete the session persistence lifecycle by adding crash recovery, session management methods, and updating outdated documentation. The existing file-based persistence (atomic write, load on startup) is functional but lacks crash detection, session deletion, export, and cleanup capabilities.

## Why

The bridge currently writes sessions to disk and loads them on restart, but treats all reloaded sessions equally — there is no distinction between a session that was intentionally stopped and one that was interrupted by a crash. Additionally, there is no way to delete, export, or clean up old sessions, which means the sessions directory grows indefinitely. The bridge-contract.yaml also incorrectly states sessions are "in-memory only."

## Scope

- Add `interrupted` status to the session lifecycle — sessions that were `active` when the bridge process terminated are marked `interrupted` on next startup
- New `session.export` method — dump full session data as JSON
- New `session.delete` method — remove a session from memory and disk (non-active sessions only)
- New `session.cleanup` method — bulk-remove sessions older than N days
- Update `docs/bridge-contract.yaml` to reflect current persistence behavior and document new methods
- Delta spec updates to `session/agent-sessions.md`

## Unchanged Behavior

- Existing file persistence mechanics (atomic write via tmp+rename, load on startup) remain unchanged
- All existing bridge methods (`session.start`, `session.resume`, `session.stop`, `session.status`, `session.list`, `session.history`, `session.events`, `session.branch`, `session.search`) continue to work identically
- In-memory mode (when `sessionsDir` is omitted) remains supported
- Session ID format (UUID v4) does not change
