## MODIFIED Requirements

### Requirement: Session Persistence

The SDK MUST persist each session to disk as a JSON file so that sessions survive bridge process restarts. The storage directory MUST be configurable; when not configured, the SDK MUST use a default location outside any project workspace.

When the bridge starts and loads sessions from disk, any session whose persisted status is `active` MUST be changed to `interrupted` and the updated state MUST be written back to disk before any client requests are served.

The session status type MUST include `interrupted` as a valid value: `"active" | "completed" | "stopped" | "interrupted"`.

#### Scenario: Session survives bridge restart
- GIVEN a client has started a session and the bridge process is restarted
- WHEN a new bridge process starts with the same sessions directory
- THEN the session is available in `session.list` and `session.status` with its prior state intact

#### Scenario: Storage directory is created if absent
- GIVEN the configured sessions directory does not exist
- WHEN the bridge starts
- THEN the directory is created automatically before any session is written

#### Scenario: Active session becomes interrupted on restart
- GIVEN a session was `active` when the bridge process terminated unexpectedly
- WHEN a new bridge process starts and loads sessions from disk
- THEN that session's status is changed to `interrupted`
- AND the session file on disk reflects the `interrupted` status

#### Scenario: Completed and stopped sessions are unchanged on restart
- GIVEN sessions with status `completed` or `stopped` exist on disk
- WHEN a new bridge process starts and loads sessions from disk
- THEN those sessions retain their original status

## ADDED Requirements

### Requirement: Session Export

The bridge MUST expose a `session.export` method that returns the full session data for a given session.

Parameters: `{ sessionId: string }`.

The response MUST include: `id`, `workspace`, `sdkSessionId`, `status`, `createdAt`, `updatedAt`, `history`, `result`.

If the session does not exist, the bridge MUST return a `-32011` error.

#### Scenario: Export a session
- GIVEN a session exists with ID "abc-123"
- WHEN a client calls `session.export` with `{ sessionId: "abc-123" }`
- THEN the response includes the full session object with all fields and the complete history array

#### Scenario: Export unknown session returns error
- GIVEN no session exists with the given ID
- WHEN a client calls `session.export`
- THEN the bridge returns a `-32011` error

### Requirement: Session Delete

The bridge MUST expose a `session.delete` method that removes a session from both memory and disk.

Parameters: `{ sessionId: string }`.

The bridge MUST return a `-32070` error if the session is `active` — active sessions cannot be deleted.

The bridge MUST return a `-32011` error if the session does not exist.

On successful deletion, the bridge MUST return `{ deleted: true, sessionId: string }`.

#### Scenario: Delete a completed session
- GIVEN a completed session with ID "abc-123" exists
- WHEN a client calls `session.delete` with `{ sessionId: "abc-123" }`
- THEN the session is removed from memory and the corresponding JSON file is deleted from disk
- AND the response is `{ deleted: true, sessionId: "abc-123" }`

#### Scenario: Delete an active session returns error
- GIVEN an active session exists
- WHEN a client calls `session.delete` for that session
- THEN the bridge returns a `-32070` error indicating active sessions cannot be deleted

#### Scenario: Delete unknown session returns error
- GIVEN no session exists with the given ID
- WHEN a client calls `session.delete`
- THEN the bridge returns a `-32011` error

### Requirement: Session Cleanup

The bridge MUST expose a `session.cleanup` method that removes sessions older than a specified number of days.

Parameters: `{ olderThanDays?: number }`.

Default `olderThanDays` is 30. The value MUST be capped at 365. The value MUST be at least 1; values below 1 MUST return a `-32602` error.

The method MUST use the session's `updatedAt` timestamp to determine age. Active sessions MUST NOT be removed by cleanup.

The response MUST include `{ removedCount: number }`.

#### Scenario: Cleanup removes old sessions
- GIVEN sessions exist with `updatedAt` more than 30 days ago and status is not `active`
- WHEN a client calls `session.cleanup` without parameters
- THEN those sessions are removed from memory and disk
- AND the response includes the count of removed sessions

#### Scenario: Cleanup respects the olderThanDays parameter
- GIVEN sessions of varying ages exist
- WHEN a client calls `session.cleanup` with `{ olderThanDays: 7 }`
- THEN only sessions whose `updatedAt` is more than 7 days ago and status is not `active` are removed

#### Scenario: Cleanup preserves active sessions
- GIVEN an active session exists with `updatedAt` more than 30 days ago
- WHEN a client calls `session.cleanup`
- THEN the active session is not removed

#### Scenario: Cleanup caps olderThanDays at 365
- GIVEN a client calls `session.cleanup` with `{ olderThanDays: 500 }`
- WHEN the bridge processes the request
- THEN the value is treated as 365

#### Scenario: Cleanup rejects invalid olderThanDays
- GIVEN a client calls `session.cleanup` with `{ olderThanDays: 0 }`
- WHEN the bridge validates the request
- THEN the bridge returns a `-32602` error
