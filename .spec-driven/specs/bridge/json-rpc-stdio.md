### Requirement: JSON-RPC Stdio Bridge
The SDK MUST expose a local JSON-RPC 2.0 interface over standard input and standard output so external tools can call it as a subprocess.

#### Scenario: Handle a valid bridge request
- GIVEN a client starts the SDK bridge as a local process
- WHEN the client sends a valid JSON-RPC 2.0 request to standard input
- THEN the bridge returns a JSON-RPC 2.0 response on standard output

#### Scenario: Reject an unsupported method
- GIVEN a client sends a JSON-RPC 2.0 request for an unsupported method
- WHEN the bridge validates the request
- THEN the bridge returns a structured JSON-RPC error response that identifies the failure

### Requirement: Capability Discovery
The SDK MUST provide a bridge capability response that tells clients which workflow operations, session features, and streaming behaviors are supported by the current SDK version.

#### Scenario: Discover bridge capabilities
- GIVEN a client connects to the bridge without prior version-specific assumptions
- WHEN the client requests bridge capabilities
- THEN the bridge returns machine-readable capability metadata for the current process

### Requirement: Streaming Notifications
The SDK MUST emit machine-readable notifications for long-running workflow and session activity so clients can present progress before a final result is available.

#### Scenario: Stream progress for a long-running request
- GIVEN a client starts a workflow or session operation that does not complete immediately
- WHEN the bridge produces intermediate progress events
- THEN the bridge sends notifications correlated to the originating request or session identifier
