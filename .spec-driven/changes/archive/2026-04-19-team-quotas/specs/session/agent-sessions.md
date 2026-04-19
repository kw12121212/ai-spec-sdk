---
mapping:
  implementation:
    - src/session-store.ts
  tests:
    - test/session-store.test.ts
---

## MODIFIED Requirements

### Requirement: Start Agent Session
Previously: The SDK MUST let a client start a Claude-backed agent session for an explicit workspace and prompt through the bridge.
The SDK MUST let a client start a Claude-backed agent session for an explicit workspace, prompt, and optional `teamId` through the bridge.

#### Scenario: Start a new session with teamId
- GIVEN a client provides a workspace path, initial prompt, and a `teamId`
- WHEN the client requests a new agent session
- THEN the bridge starts agent execution and returns a session identifier
- AND the returned session metadata includes the provided `teamId`
