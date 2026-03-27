## ADDED Requirements

### Requirement: Workflow Execution in Go CLI Example
The Go CLI example MUST demonstrate how to invoke workflows via `workflow.run` and display progress notifications.

#### Scenario: Example runs a workflow
- GIVEN the Go CLI is running
- WHEN a user executes the `/workflow <name>` command
- THEN the CLI calls `workflow.run` with the specified workflow name and workspace, and displays `bridge/progress` notifications
