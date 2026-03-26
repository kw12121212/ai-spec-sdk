## ADDED Requirements

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
