## ADDED Requirements

### Requirement: Go CLI Integration Example
The project MUST include a Go CLI example under `example/go-cli/` that demonstrates how to start the bridge as a subprocess and communicate via stdio JSON-RPC. The example MUST cover all bridge methods and serve as a reference for downstream integrators.

#### Scenario: Example builds and runs
- GIVEN the SDK has been built (`bun run build`)
- WHEN a developer runs `go build` inside `example/go-cli/`
- THEN the resulting binary can be executed and connects to the bridge via stdio

#### Scenario: Example demonstrates notification handling
- GIVEN the Go CLI is running
- WHEN a session emits `bridge/session_event` or `bridge/tool_approval_requested` notifications
- THEN the CLI renders the events to the terminal in real time
