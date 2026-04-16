---
mapping:
  implementation:
    - src/task-template-store.ts
    - src/task-template-types.ts
    - src/bridge.ts
    - src/capabilities.ts
  tests:
    - test/task-template-store.test.ts
    - test/task-template-bridge.test.ts
---

## Requirements

### Requirement: manage-task-templates
The system MUST provide a registry to manage reusable task templates.

#### Scenario: create-task-template
- GIVEN a valid task template definition (name, description, systemPrompt, etc.)
- WHEN the task template is saved to the registry
- THEN the system persists it to disk and it can be retrieved by name.

#### Scenario: retrieve-task-template
- GIVEN an existing task template in the registry
- WHEN a retrieval request is made by name
- THEN the system returns the correct task template definition.

#### Scenario: update-task-template
- GIVEN an existing task template
- WHEN an update request is made with new fields
- THEN the system updates the template on disk and subsequent retrievals reflect the new fields.

#### Scenario: list-task-templates
- GIVEN multiple task templates in the registry
- WHEN a list request is made
- THEN the system returns all available task templates.

#### Scenario: delete-task-template
- GIVEN an existing task template
- WHEN a delete request is made
- THEN the system removes it from disk and it can no longer be retrieved.