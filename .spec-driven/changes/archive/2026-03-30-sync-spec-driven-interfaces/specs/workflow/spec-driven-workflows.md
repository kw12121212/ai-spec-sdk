## MODIFIED Requirements

### Requirement: Supported Workflow Invocation
The SDK MUST let clients invoke supported spec-driven workflow operations against an explicit workspace through the bridge. Supported workflows are: `init`, `propose`, `modify`, `apply`, `verify`, `archive`, `cancel`, `list`, `maintenance`, `migrate`.

#### Scenario: Run the maintenance workflow
- GIVEN a workspace path that the bridge can access with an initialized `.spec-driven/` directory
- AND a client calls `workflow.run` with `{ workspace, workflow: "maintenance" }`
- WHEN the bridge executes the `run-maintenance` script subcommand
- THEN the bridge returns a machine-readable result describing the maintenance outcome

#### Scenario: Run the migrate workflow
- GIVEN a workspace path that contains an existing `openspec/` directory
- AND a client calls `workflow.run` with `{ workspace, workflow: "migrate" }`
- WHEN the bridge executes the `migrate` script subcommand
- THEN the bridge returns a machine-readable result describing the migration outcome

#### Scenario: Unsupported workflow is rejected
- GIVEN a client calls `workflow.run` with a workflow name not in the supported list
- WHEN the bridge validates the request
- THEN the bridge returns a `-32602` error with the list of supported workflows

### Requirement: Workflow Capability Mapping
The SDK SHOULD return machine-readable metadata that maps supported high-level workflow operations to bundled spec-driven capabilities. The mapping MUST include `maintenance → spec-driven-maintenance` and `migrate → spec-driven-maintenance`.

#### Scenario: Inspect workflow-skill mapping
- GIVEN a client requests bridge capabilities
- WHEN the bridge returns the `workflowSkillMap`
- THEN the response includes entries for `maintenance` and `migrate`
