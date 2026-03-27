## ADDED Requirements

### Requirement: Session Persistence
The SDK MUST persist each session to disk as a JSON file so that sessions survive bridge process restarts. The storage directory MUST be configurable; when not configured, the SDK MUST use a default location outside any project workspace.

#### Scenario: Session survives bridge restart
- GIVEN a client has started a session and the bridge process is restarted
- WHEN a new bridge process starts with the same sessions directory
- THEN the session is available in `session.list` and `session.status` with its prior state intact

#### Scenario: Storage directory is created if absent
- GIVEN the configured sessions directory does not exist
- WHEN the bridge starts
- THEN the directory is created automatically before any session is written

### Requirement: Session History Retrieval
The bridge MUST expose a `session.history` method that returns the stored event log for a session with offset/limit pagination.

#### Scenario: Retrieve full session history
- GIVEN a client has a session with recorded events
- WHEN the client calls `session.history` with only a `sessionId`
- THEN the response includes a `total` count and an `entries` array of history entries starting from offset 0

#### Scenario: Paginate session history
- GIVEN a session has more events than the requested limit
- WHEN the client calls `session.history` with `offset` and `limit`
- THEN the response returns only the entries in the requested window and the correct `total`

#### Scenario: Limit is capped at 200
- GIVEN a client calls `session.history` with `limit` greater than 200
- WHEN the bridge processes the request
- THEN the bridge returns at most 200 entries

#### Scenario: Unknown session returns error
- GIVEN a client calls `session.history` with an unknown `sessionId`
- WHEN the bridge processes the request
- THEN the bridge returns a `-32011` error

## MODIFIED Requirements

### Requirement: Session List Includes Initial Prompt
The `session.list` response MUST include a `prompt` field for each session entry containing the first 200 characters of the session's initial user prompt, or `null` if no initial prompt is recorded.

#### Scenario: Session list entry shows prompt preview
- GIVEN one or more sessions exist with an initial prompt
- WHEN a client calls `session.list`
- THEN each entry in the response includes a `prompt` field with up to 200 characters of the initial prompt
