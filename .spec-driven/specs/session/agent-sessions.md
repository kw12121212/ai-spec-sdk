### Requirement: Start Agent Session
The SDK MUST let a client start a Claude-backed agent session for an explicit workspace and prompt through the bridge.

#### Scenario: Start a new session
- GIVEN a client provides a workspace path and an initial prompt
- WHEN the client requests a new agent session
- THEN the bridge starts agent execution and returns a session identifier that the client can use for subsequent operations

### Requirement: Resume Agent Session
The SDK MUST let a client resume a previously created session when the session identifier is still available to the bridge.

#### Scenario: Resume existing context
- GIVEN a client previously received a session identifier from the bridge
- WHEN the client requests session resumption using that identifier
- THEN the bridge continues the session with preserved context instead of starting from an empty conversation

### Requirement: Observe Session Progress
The SDK MUST provide machine-readable session events that let clients follow progress and receive final results through the bridge.

#### Scenario: Receive session events
- GIVEN a client has started or resumed a session
- WHEN the agent emits progress or completion output
- THEN the bridge forwards machine-readable events that the client can associate with that session

### Requirement: Stop Active Session
The SDK SHOULD let a client request termination of an active session and return a clear terminal state for that session.

#### Scenario: Stop a running session
- GIVEN a client has an active session in progress
- WHEN the client requests session termination
- THEN the bridge reports whether the session stopped successfully and what terminal state was recorded

### Requirement: Workspace-Aligned Agent Working Directory
The SDK MUST set the agent's working directory to the validated workspace path when starting or resuming a session, and MUST reject any request that supplies `cwd` directly in session options.

#### Scenario: Agent runs in the specified workspace
- GIVEN a client starts a session with a valid workspace path
- WHEN the bridge launches the agent query
- THEN the agent's working directory is set to the resolved workspace path

#### Scenario: Reject explicit cwd in options
- GIVEN a client supplies a `cwd` key inside the session `options` parameter
- WHEN the bridge validates the request
- THEN the bridge returns a `-32602` error and does not start the session

### Requirement: SDK Session ID Retention
The SDK MUST capture and retain the session identifier assigned by the Claude Agent SDK upon session initialization so that subsequent resume operations use the correct SDK-side session context.

#### Scenario: SDK session_id is stored after session start
- GIVEN a client starts a new session
- WHEN the agent emits its initialization event containing a session identifier
- THEN the bridge stores that SDK-assigned identifier against the bridge session record

### Requirement: Correct Session Resume Context
The SDK MUST pass the stored SDK-assigned session identifier when resuming a session, and MUST return a clear error when the SDK session identifier is not available.

#### Scenario: Resume uses SDK session_id
- GIVEN a client previously started a session and received a bridge session identifier
- AND the bridge has stored the corresponding SDK-assigned session identifier
- WHEN the client requests session resumption
- THEN the bridge passes the stored SDK session identifier to the agent query so prior conversation context is preserved

#### Scenario: Resume fails when SDK session_id is unavailable
- GIVEN a client requests session resumption
- AND the bridge session record has no stored SDK session identifier
- WHEN the bridge attempts to resume
- THEN the bridge returns a `-32012` error indicating the SDK session identifier is not available

### Requirement: Agent Control Parameters
The bridge MUST accept the following optional first-class parameters on `session.start` and `session.resume`, validate their types, and pass them to the agent query when present:

| Parameter | Type | Description |
|---|---|---|
| `model` | string | The Claude model identifier to use for this session |
| `allowedTools` | string[] | Whitelist of tool names the agent may invoke |
| `disallowedTools` | string[] | Blacklist of tool names the agent must not invoke |
| `permissionMode` | string | One of `"default"`, `"acceptEdits"`, `"bypassPermissions"` |
| `maxTurns` | number (integer ≥ 1) | Maximum number of agentic turns before the session stops |
| `systemPrompt` | string | Custom system-level instructions prepended to the session |

The bridge MUST return a `-32602` error if any of these parameters is present with the wrong type.

The bridge MUST NOT require any of these parameters. When absent, the bridge MUST use the following defaults:
- `permissionMode`: `"bypassPermissions"`
- All others: not set (agent SDK default applies)

#### Scenario: model is passed to the agent
- GIVEN a client starts a session with `{ "model": "claude-opus-4-6" }`
- WHEN the bridge launches the agent query
- THEN the agent is invoked with the specified model

#### Scenario: allowedTools restricts available tools
- GIVEN a client starts a session with `{ "allowedTools": ["Read", "Glob"] }`
- WHEN the bridge launches the agent query
- THEN the agent is invoked with only the specified tools permitted

#### Scenario: disallowedTools blocks specified tools
- GIVEN a client starts a session with `{ "disallowedTools": ["Bash"] }`
- WHEN the bridge launches the agent query
- THEN the agent is invoked with the specified tools forbidden

#### Scenario: permissionMode controls approval behavior
- GIVEN a client starts a session with `{ "permissionMode": "acceptEdits" }`
- WHEN the bridge launches the agent query
- THEN the agent runs with the `acceptEdits` permission mode

#### Scenario: default permissionMode is bypassPermissions
- GIVEN a client starts a session without a `permissionMode` parameter
- WHEN the bridge launches the agent query
- THEN the agent runs with `bypassPermissions` permission mode

#### Scenario: maxTurns caps session length
- GIVEN a client starts a session with `{ "maxTurns": 5 }`
- WHEN the bridge launches the agent query
- THEN the agent is configured to stop after at most 5 turns

#### Scenario: systemPrompt is injected into the session
- GIVEN a client starts a session with `{ "systemPrompt": "You are a strict code reviewer." }`
- WHEN the bridge launches the agent query
- THEN the agent receives the custom system prompt

#### Scenario: invalid permissionMode value is rejected
- GIVEN a client starts a session with `{ "permissionMode": "superuser" }`
- WHEN the bridge validates the request
- THEN the bridge returns a `-32602` error identifying `permissionMode` as invalid

#### Scenario: wrong type for agent control parameter is rejected
- GIVEN a client starts a session with `{ "maxTurns": "five" }`
- WHEN the bridge validates the request
- THEN the bridge returns a `-32602` error

#### Scenario: control parameters apply on resume
- GIVEN a client resumes a session and provides `model`, `allowedTools`, or any other control parameter
- WHEN the bridge builds the agent query for the resumed session
- THEN the provided control parameters are applied to that query turn

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

### Requirement: Session List Includes Initial Prompt
The `session.list` response MUST include a `prompt` field for each session entry containing the first 200 characters of the session's initial user prompt, or `null` if no initial prompt is recorded.

#### Scenario: Session list entry shows prompt preview
- GIVEN one or more sessions exist with an initial prompt
- WHEN a client calls `session.list`
- THEN each entry in the response includes a `prompt` field with up to 200 characters of the initial prompt

### Requirement: token usage in session completion
When a session completes, the `session_completed` notification MUST include a `usage` field:
`{inputTokens: number, outputTokens: number}` if usage data was available from the SDK,
or `null` if not.
The `session.start` and `session.resume` response MUST include the same `usage` field on
completion.
Usage data is NOT persisted to disk as part of the session file.

#### Scenario: Usage is included in session completed response
- GIVEN the SDK returns usage data in its result message
- WHEN a session completes
- THEN the `session.start`/`session.resume` response and `session_completed` notification both contain `usage: {inputTokens, outputTokens}`

#### Scenario: Usage is null when SDK omits it
- GIVEN the SDK does not return usage data
- WHEN a session completes
- THEN the `usage` field is `null` in both the response and the notification

### Requirement: Session Management in Go CLI Example
The Go CLI example MUST demonstrate the full session lifecycle: start, resume, stop, list, and history retrieval, including the tool approval flow.

#### Scenario: Example starts and resumes sessions
- GIVEN the Go CLI is running
- WHEN a user types a prompt
- THEN the CLI calls `session.start` (first prompt) or `session.resume` (subsequent prompts) and streams the response

#### Scenario: Example demonstrates tool approval
- GIVEN the Go CLI is running with `permissionMode: "approve"`
- WHEN Claude requests a tool use
- THEN the CLI presents a y/n prompt to the user and calls `session.approveTool` or `session.rejectTool` based on the response

### Requirement: Session Branching
The bridge MUST expose a `session.branch` method that creates a new session forked from an existing session's history.

Parameters: `{ sessionId: string, fromIndex?: number, prompt?: string }`.

The bridge MUST:
1. Look up the source session by `sessionId`
2. Create a new session in the same workspace
3. Copy history entries from the source session up to `fromIndex` (default: all entries) into the new session as `branch_from` history entries
4. If the source session has an `sdkSessionId` and `fromIndex` is not set (or equals full history length), the new session MUST attempt to resume from that SDK session context. If `fromIndex` is explicitly set to a mid-point, the bridge MUST NOT pass the `sdkSessionId` since the SDK has no concept of branching from a mid-point.
5. If `prompt` is provided, immediately start the branched session with that prompt

If the source session does not exist, the bridge MUST return a `-32011` error.
If `fromIndex` is out of range, the bridge MUST return a `-32602` error.

#### Scenario: Branch from an existing session
- GIVEN a completed session with ID "abc-123" and 10 history entries
- WHEN a client calls `session.branch` with `{ sessionId: "abc-123" }`
- THEN the bridge creates a new session with the same workspace, copies all 10 history entries, and returns the new session ID

#### Scenario: Branch from a specific history index
- GIVEN a session with 10 history entries
- WHEN a client calls `session.branch` with `{ sessionId: "abc-123", fromIndex: 5 }`
- THEN the new session's history contains only the first 5 entries from the source

#### Scenario: Branch with an immediate prompt
- GIVEN a completed session with history
- WHEN a client calls `session.branch` with `{ sessionId: "abc-123", prompt: "Continue from here" }`
- THEN the bridge creates the new session, copies the history, and starts execution with the given prompt

#### Scenario: Branch reuses SDK session context when branching from full history
- GIVEN a source session with a stored `sdkSessionId`
- WHEN a client calls `session.branch` without `fromIndex`
- THEN the branched session's agent query is initialized with the source's `sdkSessionId` as the resume target

#### Scenario: Branch does not reuse SDK context when branching from mid-point
- GIVEN a source session with a stored `sdkSessionId` and `fromIndex` is set to a value less than full history length
- WHEN a client calls `session.branch` with `fromIndex`
- THEN the branched session starts a fresh SDK session without resume

#### Scenario: Branch from unknown session returns error
- GIVEN no session exists with the given ID
- WHEN a client calls `session.branch`
- THEN the bridge returns a `-32011` error

### Requirement: Cross-Session Search
The bridge MUST expose a `session.search` method that searches across session histories for matching text.

Parameters: `{ query: string, workspace?: string, status?: string, limit?: number }`.

The bridge MUST search through each session's history entries, looking for substring matches in `prompt` fields and stringified `message` fields. Results MUST be capped at `limit` (default 20, max 100).

The response MUST include a `results` array where each entry has: `sessionId`, `workspace`, `status`, `matches` (array of `{ historyIndex, snippet }`).

#### Scenario: Search finds matching sessions
- GIVEN sessions exist with history containing "fix authentication"
- WHEN a client calls `session.search` with `{ query: "authentication" }`
- THEN the response includes sessions whose history contains the query text, with snippets showing context around the match

#### Scenario: Search with workspace filter
- GIVEN sessions exist across multiple workspaces
- WHEN a client calls `session.search` with `{ query: "test", workspace: "/path/to/project" }`
- THEN only sessions from the specified workspace are searched

#### Scenario: Search with status filter
- GIVEN active and completed sessions exist
- WHEN a client calls `session.search` with `{ query: "test", status: "completed" }`
- THEN only completed sessions are included in results

#### Scenario: Search limit is capped at 100
- GIVEN more than 100 sessions match the query
- WHEN a client calls `session.search` with `{ query: "test", limit: 200 }`
- THEN at most 100 results are returned

#### Scenario: Search with empty query returns error
- GIVEN a client calls `session.search` with `{ query: "" }`
- WHEN the bridge validates the request
- THEN the bridge returns a `-32602` error indicating the query must be non-empty

### Requirement: Session Branch and Search Capability Advertisement
The `bridge.capabilities` response MUST include `session.branch` and `session.search` in its supported methods list.

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
