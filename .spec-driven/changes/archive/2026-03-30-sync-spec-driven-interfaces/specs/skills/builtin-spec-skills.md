## MODIFIED Requirements

### Requirement: Built-in Skill Discovery
The SDK MUST let clients discover which spec-driven skills are bundled and available through the current SDK distribution. Each skill MUST be described by a `SkillInfo` object with the following fields:
- `name` (string) — the skill's unique identifier (e.g., `spec-driven-apply`)
- `description` (string) — a human-readable one-line summary of what the skill does
- `hasScript` (boolean) — `true` if the skill has a backing script invocable via `workflow.run`; `false` for AI-only skills
- `parameters` (string[]) — for script-backed skills, the script arguments (e.g., `["<change>"]`); empty array for AI-only skills

#### Scenario: List bundled skills
- GIVEN a client wants to understand the spec-driven capabilities packaged with the SDK
- WHEN the client calls `skills.list`
- THEN the bridge returns `{ skills: SkillInfo[] }` where each entry has `name`, `description`, `hasScript`, and `parameters`

#### Scenario: New skill spec-driven-maintenance is discoverable
- GIVEN the SDK has been updated to the latest spec-driven version
- WHEN the client calls `skills.list`
- THEN the response includes a skill with `name: "spec-driven-maintenance"`, `hasScript: true`, and a non-empty `description`

#### Scenario: AI-only skills have hasScript false
- GIVEN the client calls `skills.list`
- WHEN the client inspects skills `spec-driven-brainstorm`, `spec-driven-auto`, `spec-driven-review`, or `spec-driven-spec-content`
- THEN each has `hasScript: false` and `parameters: []`
