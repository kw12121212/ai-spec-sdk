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
