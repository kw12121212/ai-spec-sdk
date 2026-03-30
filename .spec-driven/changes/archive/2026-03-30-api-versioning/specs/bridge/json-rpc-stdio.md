## ADDED Requirements

### Requirement: API Version in Capabilities
The `bridge.capabilities` response MUST include an `apiVersion` field containing the current API version as a semver string (e.g., `"0.2.0"`).

#### Scenario: Capabilities include apiVersion
- GIVEN a client calls `bridge.capabilities`
- WHEN the bridge returns its capability metadata
- THEN the response includes an `apiVersion` field with a valid semver string matching the bridge's current API version

### Requirement: Version Negotiation Method
The bridge MUST expose a `bridge.negotiateVersion` method that allows clients to declare their supported versions and receive the negotiated result.

Parameters: `{supportedVersions: string[]}` where `supportedVersions` is a non-empty array of semver strings.

If one of the client's supported versions matches the bridge's `API_VERSION`, the bridge MUST respond with `{negotiatedVersion: string, capabilities: Capabilities}` where `negotiatedVersion` is the matched version and `capabilities` is the full capabilities object.

If no version matches, the bridge MUST return error code `-32050` with `supportedVersions` in the error data.

If `supportedVersions` is missing, empty, or contains non-string values, the bridge MUST return a `-32602` error.

#### Scenario: Successful version negotiation
- GIVEN a client calls `bridge.negotiateVersion` with `{supportedVersions: ["0.2.0"]}`
- WHEN the bridge's `API_VERSION` is `"0.2.0"`
- THEN the response includes `{negotiatedVersion: "0.2.0", capabilities: {...}}` with the full capabilities object

#### Scenario: No matching version
- GIVEN a client calls `bridge.negotiateVersion` with `{supportedVersions: ["99.0.0"]}`
- WHEN the bridge's `API_VERSION` is `"0.2.0"`
- THEN the bridge returns error code `-32050` with `supportedVersions: ["0.2.0"]` in the error data

#### Scenario: Invalid supportedVersions parameter
- GIVEN a client calls `bridge.negotiateVersion` with `{supportedVersions: []}`
- WHEN the bridge validates the request
- THEN the bridge returns a `-32602` error

### Requirement: Per-Request Version Validation
When a JSON-RPC request includes an `apiVersion` field in its `params`, the bridge MUST validate it against the current `API_VERSION`. If the version does not match, the bridge MUST return error code `-32050` with `supportedVersions` in the error data.

Requests that do not include an `apiVersion` field MUST be processed normally without version validation (opt-in behavior).

#### Scenario: Request with matching apiVersion
- GIVEN a client sends a request with `params: {apiVersion: "0.2.0", ...}`
- WHEN the bridge's `API_VERSION` is `"0.2.0"`
- THEN the request is processed normally

#### Scenario: Request with unsupported apiVersion
- GIVEN a client sends a request with `params: {apiVersion: "99.0.0", ...}`
- WHEN the bridge's `API_VERSION` is `"0.2.0"`
- THEN the bridge returns error code `-32050` with `supportedVersions: ["0.2.0"]` in the error data

#### Scenario: Request without apiVersion
- GIVEN a client sends a request without an `apiVersion` field in params
- WHEN the bridge processes the request
- THEN the request is processed normally (no version check applied)

### Requirement: Version Negotiation Capability Advertisement
The `bridge.capabilities` response MUST include `bridge.negotiateVersion` in its supported methods list.

#### Scenario: Capabilities include negotiateVersion
- GIVEN a client calls `bridge.capabilities`
- WHEN the bridge returns its capability metadata
- THEN the `methods` array includes `"bridge.negotiateVersion"`
