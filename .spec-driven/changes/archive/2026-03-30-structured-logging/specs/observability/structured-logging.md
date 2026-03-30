## ADDED Requirements

### Requirement: Structured Log Output
The bridge MUST write structured log entries to stderr as JSON lines. Each line MUST be a valid JSON object.

Each log entry MUST include:
- `timestamp` — ISO-8601 string
- `level` — one of `"trace"`, `"debug"`, `"info"`, `"warn"`, `"error"`
- `message` — human-readable string describing the event

A log entry MAY include:
- `sessionId` — the session involved, when applicable
- `method` — the JSON-RPC method name, when the log relates to a dispatch
- `durationMs` — elapsed time in milliseconds, when the log relates to a timed operation
- `error` — error details (message and/or stack), when the log relates to a failure

#### Scenario: Log entry is valid JSON
- GIVEN the bridge is running with log level `trace`
- WHEN any loggable event occurs
- THEN each line written to stderr is a valid JSON object containing `timestamp`, `level`, and `message`

#### Scenario: Log entries are filtered by level
- GIVEN the bridge is running with log level `warn`
- WHEN trace-, debug-, and info-level events occur
- THEN no output is written to stderr for those events

### Requirement: Log Level Configuration
The bridge MUST read the initial log level from the `AI_SPEC_SDK_LOG_LEVEL` environment variable (case-insensitive). When the variable is not set, the default level MUST be `info`.

#### Scenario: Env var sets initial level
- GIVEN `AI_SPEC_SDK_LOG_LEVEL` is set to `"debug"`
- WHEN the bridge starts
- THEN the initial log level is `debug`

#### Scenario: Default level when env var is absent
- GIVEN `AI_SPEC_SDK_LOG_LEVEL` is not set
- WHEN the bridge starts
- THEN the initial log level is `info`
