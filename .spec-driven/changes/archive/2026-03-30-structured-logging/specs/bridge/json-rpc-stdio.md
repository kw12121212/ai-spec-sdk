## ADDED Requirements

### Requirement: bridge.setLogLevel
The bridge MUST expose a `bridge.setLogLevel` method that changes the runtime log level.

Parameters: `{ level: string }` where `level` is one of `"trace"`, `"debug"`, `"info"`, `"warn"`, `"error"`.

If `level` is not a valid log level, the bridge MUST return a `-32602` error.

On success the bridge responds with `{ level: "<new-level>" }`.

The change takes effect immediately for all subsequent log output.

#### Scenario: Set log level to debug
- GIVEN the bridge is running with default log level `info`
- WHEN a client calls `bridge.setLogLevel` with `{ level: "debug" }`
- THEN the bridge responds with `{ level: "debug" }` and subsequent log output includes debug-level entries

#### Scenario: Reject invalid log level
- GIVEN a client calls `bridge.setLogLevel` with `{ level: "verbose" }`
- WHEN the bridge validates the request
- THEN the bridge returns a `-32602` error

### Requirement: Log Level Capability Advertisement
The `bridge.capabilities` response MUST include `bridge.setLogLevel` in its supported methods list.
