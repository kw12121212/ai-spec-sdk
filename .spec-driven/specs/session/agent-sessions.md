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
