## ADDED Requirements

### Requirement: Supported Workflow Invocation
The SDK MUST let clients invoke supported spec-driven workflow operations against an explicit workspace through the bridge.

#### Scenario: Run a supported workflow operation
- GIVEN a workspace path that the bridge can access
- AND a client requests a supported workflow operation
- WHEN the bridge executes that workflow
- THEN the bridge returns a machine-readable result describing the workflow outcome

### Requirement: Workflow Result Reporting
The SDK MUST return workflow results in a structured form that includes success state, relevant artifact paths or change identifiers, and validation output when applicable.

#### Scenario: Return verification output
- GIVEN a client invokes a workflow operation that performs validation
- WHEN the workflow completes
- THEN the bridge response includes structured validation results rather than only human-formatted text

### Requirement: Workflow Capability Mapping
The SDK SHOULD return machine-readable metadata that maps supported high-level workflow operations to bundled spec-driven capabilities.

#### Scenario: Inspect workflow support metadata
- GIVEN a client requests bridge capabilities
- WHEN the bridge returns supported workflow operations
- THEN the response includes workflow capability mapping metadata suitable for host UI display

### Requirement: Workspace-Scoped Workflow Safety
The SDK MUST scope workflow execution to the workspace provided by the caller and MUST fail clearly when the requested workspace state does not satisfy workflow prerequisites.

#### Scenario: Reject missing spec-driven prerequisites
- GIVEN a client invokes a workflow that requires `.spec-driven/` initialization
- WHEN the target workspace does not contain the required prerequisite state
- THEN the bridge returns a structured error that explains the missing prerequisite
