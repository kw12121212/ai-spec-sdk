## ADDED Requirements

### Requirement: README Onboarding Coverage
The project README MUST include a working onboarding path for bridge users.

The README MUST describe:
- how to start the bridge in stdio mode
- how to start the bridge in HTTP mode
- how HTTP auth behaves by default and how `--no-auth` changes it
- at least one minimal JSON-RPC request example
- where to find the full bridge contract
- how to use the diagnostics entrypoints (`bridge.info` and `ai-spec-bridge doctor`)

#### Scenario: README supports first-run setup
- GIVEN a new user reads `README.md`
- WHEN they follow the onboarding section
- THEN they can discover how to start the bridge, make an initial request, and inspect bridge diagnostics without reading source code

### Requirement: Bridge Contract Coverage
`docs/bridge-contract.yaml` MUST document the public bridge surface described by the running bridge.

The contract file MUST cover:
- every method advertised in `bridge.capabilities.methods`
- startup modes and supported CLI entrypoints
- authentication requirements for public and protected methods
- notifications, error codes, and relevant environment variables

#### Scenario: Contract covers all advertised methods
- GIVEN a client reads `docs/bridge-contract.yaml`
- WHEN the client compares the contract to `bridge.capabilities.methods`
- THEN every advertised method has documented request, response, and auth behavior in the contract

### Requirement: Version Consistency Across User-Facing Surfaces
The package version in `package.json`, the bridge version reported by `bridge.capabilities`, and the API version reported by the same bridge process MUST use the same semver string for a given release of this project.

#### Scenario: Published metadata matches runtime version
- GIVEN a built release of the project
- WHEN a user reads `package.json` and calls `bridge.capabilities`
- THEN `package.json.version`, `bridgeVersion`, and `apiVersion` match exactly
