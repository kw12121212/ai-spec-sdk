---
mapping:
  implementation:
    - src/bridge.ts
  tests:
    - test/provider-switching-bridge.test.ts
---

## ADDED Requirements

### Requirement: Provider Switch Methods in Capabilities
The `bridge.capabilities` `methods` array MUST include `"provider.switch"` and `"session.setProvider"`.

#### Scenario: New methods appear in capabilities
- GIVEN the bridge is running
- WHEN a client calls `bridge.capabilities`
- THEN the response `methods` array contains both `"provider.switch"` and `"session.setProvider"`
