---
mapping:
  implementation:
    - src/session-store.ts
    - src/bridge.ts
  tests:
    - test/provider-switching.test.ts
    - test/provider-switching-bridge.test.ts
---

## ADDED Requirements

### Requirement: Active Provider Field in Session Record
Session records MUST include an optional `activeProviderId` field (string | undefined) that tracks which LLM provider the session is configured to use.

This field MUST be persisted to disk alongside other session fields and restored on bridge restart.

#### Scenario: Active provider is persisted
- GIVEN a session has `activeProviderId: "my-openai"`
- WHEN the session is saved to disk
- THEN the JSON file includes the `activeProviderId` field

#### Scenario: Active provider is restored on restart
- GIVEN a session file on disk contains `activeProviderId: "my-openai"`
- WHEN the bridge restarts and loads the session
- THEN the session's `activeProviderId` is correctly restored to `"my-openai"`

#### Scenario: Absent activeProviderId defaults to undefined
- GIVEN a session file on disk does NOT contain `activeProviderId`
- WHEN the bridge loads the session
- THEN the session's `activeProviderId` is `undefined`
