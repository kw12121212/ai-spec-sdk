## ADDED Requirements

### Requirement: Session Management in Go CLI Example
The Go CLI example MUST demonstrate the full session lifecycle: start, resume, stop, list, and history retrieval, including the tool approval flow.

#### Scenario: Example starts and resumes sessions
- GIVEN the Go CLI is running
- WHEN a user types a prompt
- THEN the CLI calls `session.start` (first prompt) or `session.resume` (subsequent prompts) and streams the response

#### Scenario: Example demonstrates tool approval
- GIVEN the Go CLI is running with `permissionMode: "approve"`
- WHEN Claude requests a tool use
- THEN the CLI presents a y/n prompt to the user and calls `session.approveTool` or `session.rejectTool` based on the response
