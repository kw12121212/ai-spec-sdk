---
mapping:
  implementation:
    - src/session-store.ts
    - src/agent-state-machine.ts
    - src/claude-agent-runner.ts
    - src/bridge.ts
    - src/capabilities.ts
    - src/workspace-store.ts
    - src/template-store.ts
    - src/audit-log.ts
    - src/context-store.ts
    - src/config-store.ts
  tests:
    - test/session-store.test.ts
    - test/session-store-audit.test.ts
    - test/session.test.ts
    - test/bridge.test.ts
    - test/agent-state-machine.test.ts
    - test/template-store.test.ts
    - test/workspace-store.test.ts
    - test/context-store.test.ts
    - test/config-store.test.ts
    - test/anthropic-adapter.test.ts
    - test/llm-provider.test.ts
---
### Requirement: Start Agent Session
The SDK MUST let a client start a Claude-backed agent session for an explicit workspace and prompt through the bridge.

#### Scenario: Start a new session
- GIVEN a client provides a workspace path and an initial prompt
- WHEN the client requests a new agent session
- THEN the bridge starts agent execution and returns a session identifier that the client can use for subsequent operations

### Requirement: Resume Agent Session
The SDK MUST let a client resume a previously created session when the session identifier is still available to the bridge.

The existing `session.resume` method MUST support resuming from the `"paused"` state.

When `executionState` is `"paused"` and `session.resume` is called, the bridge MUST:
1. Transition `executionState` to `"running"`
2. Clear the `pausedAt` and `pauseReason` fields
3. Continue executing the agent query using the stored `sdkSessionId` and message history
4. Return the same response format as the existing `session.resume`

#### Scenario: Resume existing context
- GIVEN a client previously received a session identifier from the bridge
- WHEN the client requests session resumption using that identifier
- THEN the bridge continues the session with preserved context instead of starting from an empty conversation

#### Scenario: Resume from paused state
- GIVEN a session with `executionState` `"paused"`
- WHEN the client calls `session.resume`
- THEN the session's `executionState` becomes `"running"`
- AND the agent query continues execution

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

### Requirement: Pause Agent Session
The bridge MUST expose a `session.pause` method that allows clients to pause an actively executing session.

Parameters: `{ sessionId: string, reason?: string }`.

The bridge MUST:
1. Verify the `sessionId` exists; return `-32011` error if not
2. Check the session's `executionState`; only allow pause from `"running"` or `"waiting_for_input"`
3. Return `-32602` error with reason if state is invalid
4. Transition `executionState` to `"paused"`
5. Record `pausedAt` timestamp (ISO 8601)
6. Save the `reason` if provided
7. Persist the session state to disk
8. Return `{ success: true, sessionId: string, pausedAt: string }`

#### Scenario: Pause a running session
- GIVEN a session with `executionState` `"running"`
- WHEN the client calls `session.pause` with that session ID
- THEN the session's `executionState` becomes `"paused"`
- AND `pausedAt` timestamp is returned

#### Scenario: Pause a waiting-for-input session
- GIVEN a session with `executionState` `"waiting_for_input"`
- WHEN the client calls `session.pause`
- THEN the session is successfully paused

#### Scenario: Pause from invalid state returns error
- GIVEN a session with `executionState` `"idle"`
- WHEN the client calls `session.pause`
- THEN `-32602` error is returned

#### Scenario: Pause unknown session returns error
- GIVEN no session exists
- WHEN the client calls `session.pause` with invalid ID
- THEN `-32011` error is returned

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

Session persistence MUST include pause-related fields:
- `pausedAt?: string` - ISO 8601 timestamp
- `pauseReason?: string` - user-provided pause reason

#### Scenario: Pause fields are persisted
- GIVEN a paused session
- WHEN the session is saved to disk
- THEN the JSON file includes `pausedAt` field (may include `pauseReason`)

#### Scenario: Pause fields are restored
- GIVEN a session file on disk containing `pausedAt`
- WHEN the bridge starts and loads that session
- THEN the session's `pausedAt` and `pauseReason` are correctly restored

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

### Requirement: Custom Tools in Session Control Parameters
The `allowedTools` and `disallowedTools` parameters on `session.start` and `session.resume` MUST accept custom tool names (prefixed with `custom.`).

#### Scenario: Allow custom tools in session
- GIVEN a workspace with registered custom tools `custom.build` and `custom.test`
- WHEN the client starts a session with `allowedTools: ["Read", "custom.build"]`
- THEN the agent receives both the `Read` tool and the `custom.build` tool definition
- AND the `custom.test` tool is not available to the agent

#### Scenario: Disallow specific custom tools
- GIVEN a workspace with registered custom tools
- WHEN the client starts a session with `disallowedTools: ["custom.deploy"]`
- THEN all custom tools except `custom.deploy` are available if listed in `allowedTools`

### Requirement: Custom Tool Execution Context
Custom tools invoked by the agent MUST execute in the session's workspace directory with proper error handling.

#### Scenario: Custom tool executes in workspace
- GIVEN an active session for workspace `/home/user/project`
- WHEN the agent invokes a custom tool registered for that workspace
- THEN the shell command executes with `cwd` set to `/home/user/project`

#### Scenario: Custom tool execution failure
- GIVEN a custom tool that executes a failing command
- WHEN the agent invokes the tool
- THEN the error is captured and returned to the agent as a tool error result
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

### Requirement: Child Session Spawning
The bridge MUST support creating a child session from an existing parent session via `session.spawn`.

The child session MUST:
- be linked to the parent via `parentSessionId`
- inherit the parent workspace boundary
- return its own bridge session identifier to the caller

#### Scenario: Spawn child session from parent
- GIVEN a parent session exists in the bridge
- WHEN a client calls `session.spawn` with that parent session ID and a prompt
- THEN the bridge creates a new child session linked to the parent
- AND the child session uses the same workspace as the parent

### Requirement: Parent Stop Cascades to Active Descendants
When a parent session is stopped, the bridge MUST recursively stop all active descendant sessions linked through `parentSessionId`.

#### Scenario: Stop parent session tree
- GIVEN a parent session has one or more active child sessions
- WHEN the client stops the parent session
- THEN the bridge marks the parent and all active descendants as stopped

### Requirement: Parent Session Receives Child Notifications
When a child session emits parent-relevant activity, the bridge MUST emit a `bridge/subagent_event` notification on the parent session stream.

The notification MUST include:
- `sessionId` (parent session ID)
- `subagentId` (child session ID)
- `type` (propagated child event type)

Terminal child notifications MUST also include `status`.

#### Scenario: Parent receives child completion notification
- GIVEN a child session belongs to a parent session
- WHEN the child completes or stops
- THEN the parent session stream includes a `bridge/subagent_event` notification for that child

### Requirement: Parent Linkage in Session Metadata
The bridge MUST expose `parentSessionId` in session metadata responses.

`session.status`, `session.list`, and `session.export` MUST include `parentSessionId`.
Root sessions MUST report `parentSessionId: null`.

#### Scenario: Session metadata reports parent linkage
- GIVEN the bridge has both root sessions and child sessions
- WHEN a client requests session metadata
- THEN child sessions include their parent session ID
- AND root sessions include `parentSessionId: null`

### Requirement: Session List Parent Filter
The `session.list` method MUST accept an optional `parentSessionId` filter that returns only the child sessions for that parent.

#### Scenario: List only children of a parent session
- GIVEN a bridge has multiple root sessions and child sessions
- WHEN a client calls `session.list` with `parentSessionId`
- THEN the response contains only sessions linked to that parent

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

### Requirement: Agent Execution State Machine

Each session MUST maintain an `executionState` field, distinct from the existing `status` field, that tracks the agent's current execution phase.

The `executionState` type MUST be: `"idle" | "running" | "paused" | "waiting_for_input" | "error" | "completed"`.

#### Scenario: New session starts in idle state
- GIVEN a client starts a new session
- WHEN the session is created
- THEN the session's `executionState` is `"idle"`

#### Scenario: Execution state transitions to running
- GIVEN a session with `executionState` `"idle"`
- WHEN the bridge begins executing the agent query
- THEN the session's `executionState` transitions to `"running"`

#### Scenario: Execution state transitions to completed
- GIVEN a session with `executionState` `"running"`
- WHEN the agent query returns successfully
- THEN the session's `executionState` transitions to `"completed"`

#### Scenario: Execution state transitions to waiting_for_input
- GIVEN a session with `executionState` `"running"`
- WHEN the agent requests tool approval that requires human decision
- THEN the session's `executionState` transitions to `"waiting_for_input"`

#### Scenario: Execution state returns to running from waiting_for_input
- GIVEN a session with `executionState` `"waiting_for_input"`
- WHEN the tool approval is received
- THEN the session's `executionState` transitions back to `"running"`

#### Scenario: Execution state transitions to error on failure
- GIVEN a session with `executionState` `"running"` or `"idle"`
- WHEN the agent query throws an error or fails to start
- THEN the session's `executionState` transitions to `"error"`

#### Scenario: Transition from running to paused succeeds
- GIVEN a state machine in state `"running"`
- WHEN transition("paused", "user_pause") is called
- THEN the transition succeeds and returns true

#### Scenario: Transition from paused to running succeeds
- GIVEN a state machine in state `"paused"`
- WHEN transition("running", "user_resume") is called
- THEN the transition succeeds and returns true

#### Scenario: Invalid transition is rejected
- GIVEN a state machine in state `"idle"`
- WHEN transition("paused", "user_pause") is called
- THEN the transition fails and returns false

### Requirement: Invalid State Transitions Are Rejected

The state machine MUST reject transitions that are not in the valid transition table.

#### Scenario: Transition from completed is rejected
- GIVEN a session with `executionState` `"completed"`
- WHEN any state transition is attempted
- THEN the transition is rejected and the state remains `"completed"`

#### Scenario: Transition from idle to paused is rejected
- GIVEN a session with `executionState` `"idle"`
- WHEN a transition to `"paused"` is attempted
- THEN the transition is rejected

### Requirement: State Transition Events

The state machine MUST emit a transition event whenever the execution state changes.

The transition event MUST include: `sessionId`, `from` (previous state), `to` (new state), `trigger` (reason for the transition), and `timestamp`.

#### Scenario: Transition event is emitted
- GIVEN a session transitions from `"idle"` to `"running"`
- WHEN the transition occurs
- THEN an event is emitted with `{ sessionId, from: "idle", to: "running", trigger: "query_started", timestamp }`

### Requirement: Execution State and Persistence Status Are Independent

The `executionState` field and the `status` field MUST be managed independently with defined mapping rules.

- `session.start` / query begins: `status` → `"active"`, `executionState` → `"running"`
- Query completes successfully: `status` → `"completed"`, `executionState` → `"completed"`
- `session.stop` while running: `status` → `"stopped"`, `executionState` → `"completed"`
- Query error: `status` → `"completed"` (existing behavior: result contains error), `executionState` → `"error"`
- Bridge restart with active session: `status` → `"interrupted"`, `executionState` → `"error"`

#### Scenario: Stop while running sets both fields
- GIVEN a session with `status` `"active"` and `executionState` `"running"`
- WHEN the client calls `session.stop`
- THEN `status` becomes `"stopped"` and `executionState` becomes `"completed"`

#### Scenario: Error during execution sets both fields
- GIVEN a session with `executionState` `"running"`
- WHEN the agent query throws an unrecoverable error
- THEN `executionState` becomes `"error"` and `status` becomes `"completed"` (with error result)

#### Scenario: Interrupted session on restart
- GIVEN a session was `"active"` / `"running"` when the bridge terminated
- WHEN a new bridge process loads the session
- THEN `status` becomes `"interrupted"` and `executionState` becomes `"error"`

### Requirement: Execution State Is Persisted

The `executionState` field MUST be persisted to disk as part of the session JSON file.

#### Scenario: Execution state survives bridge restart
- GIVEN a session has `executionState` `"paused"` when the bridge restarts
- WHEN the session is loaded from disk
- THEN the session retains `executionState` `"paused"`

### Requirement: Execution State in Session Metadata

The `session.status`, `session.list`, and `session.export` responses MUST include the `executionState` field.

The `session.status`, `session.list`, and `session.export` responses MUST include pause-related fields (if present):
- `pausedAt?: string`
- `pauseReason?: string`

#### Scenario: Session status includes execution state
- GIVEN a session with `executionState` `"running"`
- WHEN a client calls `session.status`
- THEN the response includes `executionState: "running"`

#### Scenario: Session list includes execution state
- GIVEN sessions exist with various execution states
- WHEN a client calls `session.list`
- THEN each entry includes its `executionState`

#### Scenario: Status response includes pause info
- GIVEN a paused session
- WHEN a client calls `session.status`
- THEN the response includes `pausedAt` (may include `pauseReason`)

### Requirement: Pause/Resume Audit Logging

The bridge MUST write audit log entries for pause and resume operations:
- `session_paused` event (category: "lifecycle"), payload includes `reason` (if any) and `pausedAt`
- `session_resumed` event (category: "lifecycle"), payload includes `resumedAt`

#### Scenario: Pause writes audit log
- GIVEN a client pauses a session
- WHEN the pause operation completes
- THEN a `session_paused` audit entry exists

#### Scenario: Resume writes audit log
- GIVEN a client resumes a paused session
- WHEN the resume operation completes
- THEN a `session_resumed` audit entry exists

### Requirement: Capabilities include session.pause

The `bridge.capabilities` response MUST include `session.pause` in the supported methods list.

#### Scenario: Capabilities include session.pause
- GIVEN a client calls `bridge.capabilities`
- THEN the `methods` array in the response includes `"session.pause"`

## Requirement: Session Store Audit Integration

The `SessionStore` MUST accept an `AuditLog` instance via its constructor and use it to write audit entries for state transitions.

When `transitionExecutionState` is called and the state machine transition succeeds, the `SessionStore` MUST additionally write a `state_transition` audit entry through the `AuditLog` instance (if provided). If no `AuditLog` instance is provided, state transitions MUST still function normally without audit entries.

When `create` is called and a new session is initialized, the `SessionStore` MUST write a `session_created` audit entry through the `AuditLog` instance (if provided).

#### Scenario: SessionStore writes audit on state transition
- GIVEN a SessionStore is constructed with an AuditLog instance
- AND a session is created
- WHEN transitionExecutionState moves the session from "idle" to "running"
- THEN the AuditLog receives a write call with eventType "state_transition"

#### Scenario: SessionStore works without AuditLog
- GIVEN a SessionStore is constructed without an AuditLog instance
- WHEN a session is created and transitions states
- THEN operations succeed normally and no error is thrown

#### Scenario: SessionStore writes audit on create
- GIVEN a SessionStore is constructed with an AuditLog instance
- WHEN create() is called with a workspace and prompt
- THEN the AuditLog receives a write call with eventType "session_created"

### Requirement: Cancel Agent Session
The bridge MUST expose a `session.cancel` method that allows clients to cancel an actively executing session.

Parameters: `{ sessionId: string, reason?: string }`.

The bridge MUST:
1. Verify the `sessionId` exists; return `-32011` error if not
2. Check the session's `executionState`; only allow cancel from `"running"` or `"waiting_for_input"`
3. Return `-32602` error with reason if state is invalid
4. Transition `executionState` to `"completed"`
5. Record `cancelledAt` timestamp (ISO 8601)
6. Save the `reason` if provided, defaulting to `"user_requested"`
7. Attempt to abort any in-progress agent query
8. Write an audit log entry for the cancellation
9. Persist the session state to disk
10. Return `{ success: true, sessionId: string, cancelledAt: string }`

#### Scenario: Cancel a running session
- GIVEN a session with `executionState` `"running"`
- WHEN the client calls `session.cancel` with that session ID
- THEN the session's `executionState` becomes `"completed"`
- AND `cancelledAt` timestamp is returned

#### Scenario: Cancel a waiting-for-input session
- GIVEN a session with `executionState` `"waiting_for_input"`
- WHEN the client calls `session.cancel`
- THEN the session is successfully cancelled

#### Scenario: Cancel from invalid state returns error
- GIVEN a session with `executionState` `"idle"`
- WHEN the client calls `session.cancel`
- THEN `-32602` error is returned

#### Scenario: Cancel unknown session returns error
- GIVEN no session exists
- WHEN the client calls `session.cancel` with invalid ID
- THEN `-32011` error is returned

### Requirement: Session Execution Timeout
The bridge MUST accept an optional `timeoutMs` parameter on `session.start` and `session.resume` that automatically cancels the session after the specified duration.

The `timeoutMs` parameter MUST be an integer ≥ 1 (millisecond). If provided and less than 1, the bridge MUST return a `-32602` error.

When `timeoutMs` is provided:
1. The bridge MUST schedule a timer that cancels the session after `timeoutMs` milliseconds
2. If the session completes normally before the timeout, the timer MUST be cleared
3. When the timeout triggers, the bridge MUST cancel the session with `reason` `"timeout"`
4. The `timeoutMs` value MUST be persisted to disk as part of the session

#### Scenario: Session times out after specified duration
- GIVEN a client starts a session with `timeoutMs: 5000`
- WHEN 5 seconds pass without the session completing
- THEN the session is automatically cancelled with `cancelReason` `"timeout"`

#### Scenario: Timeout cleared when session completes normally
- GIVEN a session is started with `timeoutMs`
- WHEN the session completes before the timeout duration
- THEN the timer is cleared and the session is not cancelled

#### Scenario: timeoutMs < 1 returns error
- GIVEN a client calls `session.start` with `timeoutMs: 0`
- WHEN the bridge validates the request
- THEN the bridge returns a `-32602` error

#### Scenario: timeoutMs applies on resume
- GIVEN a client resumes a session with `timeoutMs: 10000`
- WHEN the resume operation is processed
- THEN the timeout is scheduled for 10 seconds

### Requirement: Cancellation Metadata in Session Responses
The `session.status`, `session.list`, and `session.export` responses MUST include cancellation-related fields when applicable:
- `cancelledAt?: string` - ISO 8601 timestamp when cancelled
- `cancelReason?: string` - reason for cancellation
- `timeoutMs?: number` - configured timeout duration

#### Scenario: Session status includes cancellation metadata
- GIVEN a cancelled session
- WHEN the client calls `session.status`
- THEN the response includes `cancelledAt` and `cancelReason`

#### Scenario: Session list includes cancellation metadata
- GIVEN multiple sessions, some cancelled
- WHEN the client calls `session.list`
- THEN each cancelled sessions include cancellation metadata

#### Scenario: Session export includes cancellation metadata
- GIVEN a cancelled session
- WHEN the client calls `session.export`
- THEN the response includes all cancellation-related fields

### Requirement: Cancellation Audit Logging
The bridge MUST write audit log entries for cancellation and timeout events:
- `session_cancelled` event (category: "lifecycle"), payload includes `reason` and `cancelledAt`
- `session_timed_out` event (category: "lifecycle"), payload includes `timeoutMs` and `cancelledAt`

#### Scenario: Cancel writes audit log
- GIVEN a client cancels a session
- WHEN the cancel operation completes
- THEN a `session_cancelled` audit entry exists

#### Scenario: Timeout writes audit log
- GIVEN a session times out
- WHEN the timeout cancellation completes
- THEN a `session_timed_out` audit entry exists

### Requirement: Capabilities include session.cancel
The `bridge.capabilities` response MUST include `session.cancel` in the supported methods list.

#### Scenario: Capabilities include session.cancel
- GIVEN a client calls `bridge.capabilities`
- THEN the `methods` array in the response includes `"session.cancel"`
