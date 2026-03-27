## ADDED Requirements

### Requirement: Session Branching
The bridge MUST expose a `session.branch` method that creates a new session forked from an existing session's history.

Parameters: `{ sessionId: string, fromIndex?: number, prompt?: string }`.

The bridge MUST:
1. Look up the source session by `sessionId`
2. Create a new session in the same workspace
3. Copy history entries from the source session up to `fromIndex` (default: all entries) into the new session as a `branch_from` history entry
4. If the source session has an `sdkSessionId`, the new session MUST attempt to resume from that SDK session context
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

#### Scenario: Branch reuses SDK session context
- GIVEN a source session with a stored `sdkSessionId`
- WHEN a client calls `session.branch`
- THEN the branched session's agent query is initialized with the source's `sdkSessionId` as the resume target

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
