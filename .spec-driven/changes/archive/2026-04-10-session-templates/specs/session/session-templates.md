## ADDED Requirements

### Requirement: Create Session Template
The SDK MUST allow clients to save a named session template containing commonly used session parameters.

#### Scenario: Create a new template
- GIVEN a client provides a template name and session parameters
- WHEN the client calls `template.create`
- THEN the template is persisted and can be retrieved by name

#### Scenario: Update existing template
- GIVEN a template with the given name already exists
- WHEN the client calls `template.create` with the same name
- THEN the existing template is replaced with the new parameters

### Requirement: Retrieve Session Template
The SDK MUST allow clients to retrieve a previously created template by name.

#### Scenario: Get existing template
- GIVEN a template was previously created with a specific name
- WHEN the client calls `template.get` with that name
- THEN the template is returned with all stored parameters

#### Scenario: Get non-existent template
- GIVEN no template exists with the given name
- WHEN the client calls `template.get`
- THEN null is returned

### Requirement: List Session Templates
The SDK MUST allow clients to list all available templates.

#### Scenario: List all templates
- GIVEN multiple templates have been created
- WHEN the client calls `template.list`
- THEN all templates are returned, sorted alphabetically by name

### Requirement: Delete Session Template
The SDK MUST allow clients to delete a template by name.

#### Scenario: Delete existing template
- GIVEN a template exists with the given name
- WHEN the client calls `template.delete`
- THEN the template is removed and subsequent `template.get` returns null

### Requirement: Use Template When Starting Session
The SDK MUST allow clients to reference a template when starting a session, with explicit parameters overriding template defaults.

#### Scenario: Start session with template
- GIVEN a template exists with predefined parameters
- WHEN the client calls `session.start` with the `template` parameter
- THEN the session uses the template parameters as defaults

#### Scenario: Explicit parameters override template
- GIVEN a template exists with `model: "claude-3-opus"`
- WHEN the client calls `session.start` with `template` and explicit `model: "claude-3-sonnet"`
- THEN the session uses "claude-3-sonnet" (explicit value overrides template)

#### Scenario: Missing template error
- GIVEN the client provides a template name that does not exist
- WHEN the client calls `session.start` with that template name
- THEN the bridge returns a `-32021` error indicating the template was not found

### Requirement: Template Parameter Validation
The SDK MUST validate template parameters using the same rules as `session.start`.

#### Scenario: Invalid model type
- GIVEN a client provides a non-string `model` parameter
- WHEN the client calls `template.create`
- THEN the bridge returns a `-32602` error

#### Scenario: Invalid allowedTools type
- GIVEN a client provides a non-array `allowedTools` parameter
- WHEN the client calls `template.create`
- THEN the bridge returns a `-32602` error
