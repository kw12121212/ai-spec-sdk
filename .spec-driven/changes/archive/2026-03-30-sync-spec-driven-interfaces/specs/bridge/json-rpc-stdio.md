## MODIFIED Requirements

### Requirement: Capability Discovery
The SDK MUST provide a bridge capability response that tells clients which workflow operations, session features, and streaming behaviors are supported by the current SDK version. The `workflows` array MUST include `maintenance` and `migrate`. The `skills` array MUST include `spec-driven-maintenance`.

#### Scenario: Discover bridge capabilities with new workflows
- GIVEN a client connects to the bridge without prior version-specific assumptions
- WHEN the client requests `bridge.capabilities`
- THEN the response `workflows` array includes `maintenance` and `migrate`
- AND the `skills` array includes `spec-driven-maintenance`
- AND the `workflowSkillMap` includes entries for `maintenance` and `migrate`

### Requirement: Skills List Method
The bridge MUST expose a `skills.list` method that returns structured metadata for each built-in spec-driven skill.

#### Scenario: Skills list returns SkillInfo objects
- GIVEN a client calls `skills.list` with no parameters
- WHEN the bridge processes the request
- THEN the response includes a `skills` array where each entry is an object with `name` (string), `description` (string), `hasScript` (boolean), and `parameters` (string[])

#### Scenario: Skills list includes 12 skills
- GIVEN the bridge is running with the latest spec-driven integration
- WHEN the client calls `skills.list`
- THEN the response `skills` array contains exactly 12 entries

#### Scenario: Skills list includes spec-driven-maintenance
- GIVEN the client calls `skills.list`
- WHEN the client inspects the skills array
- THEN an entry with `name: "spec-driven-maintenance"` is present with `hasScript: true`
