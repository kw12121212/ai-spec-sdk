## ADDED Requirements

### Requirement: Diagnostic Metadata Authorization
When the bridge is running in HTTP mode with auth enabled, `bridge.info` MUST require a key authorized for admin-level methods. Requests without valid credentials, or with a key lacking the required scope, MUST be rejected using the existing authentication and authorization error codes.

#### Scenario: Unauthenticated bridge.info request is rejected
- GIVEN the bridge is running in HTTP mode with auth enabled
- WHEN a client calls `bridge.info` without an `Authorization` header
- THEN the response contains JSON-RPC error code `-32061`

#### Scenario: Admin-authorized bridge.info request succeeds
- GIVEN the bridge is running in HTTP mode with auth enabled
- AND the client presents a valid key with `admin` scope
- WHEN the client calls `bridge.info`
- THEN the bridge returns the runtime metadata response normally
