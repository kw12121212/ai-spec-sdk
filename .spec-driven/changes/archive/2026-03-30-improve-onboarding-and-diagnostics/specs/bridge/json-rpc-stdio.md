## MODIFIED Requirements

### Requirement: Capability Discovery
The SDK MUST provide a bridge capability response that tells clients which workflow operations, session features, and streaming behaviors are supported by the current SDK version. The response MUST include a `transport` field whose value is `"stdio"` when running in stdio mode and `"http"` when running in HTTP mode.

The `methods` array MUST advertise every callable JSON-RPC method exposed by the current build. If a method is callable from the same bridge process, it MUST appear in `bridge.capabilities.methods`; conversely, a method listed in `bridge.capabilities.methods` MUST be callable from that process.

#### Scenario: Capabilities include the complete public method surface
- GIVEN a client calls `bridge.capabilities`
- WHEN the bridge returns its capability metadata
- THEN the `methods` array includes `session.export`, `session.delete`, `session.cleanup`, and `bridge.info`

## ADDED Requirements

### Requirement: Bridge Runtime Info Method
The bridge MUST expose a `bridge.info` method that returns read-only runtime metadata for the current bridge process.

The response MUST include:
- `bridgeVersion` (string)
- `apiVersion` (string)
- `transport` (`"stdio"` | `"http"`)
- `authMode` (string — `"none"` for stdio or no-auth HTTP, `"bearer"` for HTTP with auth enabled)
- `logLevel` (string)
- `sessionsPath` (string — resolved absolute path to the sessions directory)
- `keysPath` (string — resolved absolute path to the keys file)
- `specDrivenScriptPath` (string — resolved absolute path to the spec-driven.js script)
- `nodeVersion` (string)

When the bridge is running in HTTP mode, the response MUST also include an `http` object with the resolved `port` (number) and `corsOrigins` (string) values. When running in stdio mode, `http` MUST be `null`.

`bridge.info` is descriptive only and MUST NOT modify bridge state.

#### Scenario: bridge.info reports stdio runtime metadata
- GIVEN the bridge is running in stdio mode
- WHEN a client calls `bridge.info`
- THEN the response includes `bridgeVersion`, `apiVersion`, `transport: "stdio"`, `authMode`, `logLevel`, `sessionsPath`, `keysPath`, `specDrivenScriptPath`, and `nodeVersion`
- AND `http` is `null`
- AND the method does not create, delete, or mutate sessions or config

#### Scenario: bridge.info reports HTTP runtime metadata
- GIVEN the bridge is running in HTTP mode
- WHEN a client calls `bridge.info`
- THEN the response includes `transport: "http"`
- AND includes an `http` object with the resolved `port` and `corsOrigins`
