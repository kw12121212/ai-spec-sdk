## MODIFIED Requirements

### Requirement: Capability Discovery
The SDK MUST provide a bridge capability response that tells clients which workflow operations, session features, and streaming behaviors are supported by the current SDK version. The response MUST include a `transport` field whose value is `"stdio"` when running in stdio mode and `"http"` when running in HTTP mode.

#### Scenario: Discover bridge capabilities
- GIVEN a client connects to the bridge without prior version-specific assumptions
- WHEN the client requests bridge capabilities
- THEN the bridge returns machine-readable capability metadata for the current process

#### Scenario: Stdio mode reports transport in capabilities
- GIVEN the bridge is running in stdio mode (default)
- WHEN a client calls `bridge.capabilities`
- THEN the response includes `transport: "stdio"`
