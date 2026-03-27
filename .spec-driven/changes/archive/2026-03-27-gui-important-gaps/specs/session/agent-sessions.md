# Delta spec: session/agent-sessions.md

## ADDED Requirements

### Requirement: token usage in session completion
When a session completes, the `session_completed` notification MUST include a `usage` field:
`{inputTokens: number, outputTokens: number}` if usage data was available from the SDK,
or `null` if not.
The `session.start` and `session.resume` response MUST include the same `usage` field on
completion.
Usage data is NOT persisted to disk as part of the session file.
