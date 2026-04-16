---
mapping:
  implementation:
    - src/bridge.ts
  tests:
    - test/bridge.test.ts
---

## MODIFIED Requirements

### Requirement: Audit Entry Schema
Previously: The "Defined Event Types" table defined `hook_execution` under the `security` category but not permission events.
The "Defined Event Types" table MUST include the following additional events under the `security` category:

| eventType | category | payload fields |
|---|---|---|
| `scope_denied` | security | `toolName`, `requiredScopes`, `allowedScopes?`, `blockedScopes?` |
| `policy_decision` | security | `policyName`, `decision`, `toolName`, `durationMs` |

#### Scenario: Scope denial is audited
- GIVEN a session with scope restrictions
- WHEN a tool is denied by scope
- THEN an audit entry with `eventType` "scope_denied" and `category` "security" is written
- AND the payload includes `toolName`, `requiredScopes`, `allowedScopes`, and `blockedScopes`

#### Scenario: Policy decision is audited
- GIVEN a session with a registered permission policy
- WHEN the policy executes and returns `allow` or `deny`
- THEN an audit entry with `eventType` "policy_decision" and `category` "security" is written
- AND the payload includes `policyName`, `decision`, `toolName`, and `durationMs`
