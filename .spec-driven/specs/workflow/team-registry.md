---
mapping:
  implementation:
    - src/team-store.ts
    - src/team-types.ts
    - src/bridge.ts
    - src/capabilities.ts
  tests:
    - test/team-store.test.ts
    - test/team-bridge.test.ts
---

## Requirements

### Requirement: manage-teams
The system MUST provide a registry to manage teams with members and workspace associations.

#### Scenario: create-team
- GIVEN a valid team definition (name, description)
- WHEN the team is created via `team.create`
- THEN the system persists the team and the creator is automatically added as a member with the `owner` role.
- AND the response includes the team object with `name`, `description`, `members`, `workspaces`, `version`, `createdAt`, and `updatedAt`.

#### Scenario: create-team-with-initial-members
- GIVEN a team creation request with `members` array
- WHEN the team is created
- THEN all specified members are added with their provided roles alongside the creator as `owner`.

#### Scenario: create-team-with-initial-workspaces
- GIVEN a team creation request with `workspaces` array
- WHEN the team is created
- THEN all specified workspace paths are associated with the team.

#### Scenario: get-team
- GIVEN an existing team in the registry
- WHEN a `team.get` request is made by name
- THEN the system returns the complete team object.

#### Scenario: get-team-not-found
- GIVEN no team exists with the given name
- WHEN a `team.get` request is made
- THEN the system returns a `-32031` error.

#### Scenario: update-team
- GIVEN an existing team
- WHEN a `team.update` request is made with new `description` and/or `workspaces`
- THEN the system updates the team, increments the version, and returns the updated team.

#### Scenario: update-team-not-found
- GIVEN no team exists with the given name
- WHEN a `team.update` request is made
- THEN the system returns a `-32031` error.

#### Scenario: list-teams
- GIVEN multiple teams in the registry
- WHEN a `team.list` request is made
- THEN the system returns all teams sorted by name.

#### Scenario: delete-team
- GIVEN an existing team
- WHEN a `team.delete` request is made by name
- THEN the system removes the team from memory and disk.

#### Scenario: delete-team-not-found
- GIVEN no team exists with the given name
- WHEN a `team.delete` request is made
- THEN the system returns a `-32031` error.

### Requirement: manage-team-members
The system MUST support adding and removing team members with roles.

#### Scenario: add-member
- GIVEN an existing team
- WHEN a `team.addMember` request is made with `name`, `userId`, and `role`
- THEN the member is added to the team and the team is persisted.

#### Scenario: add-member-duplicate
- GIVEN an existing team with a member having `userId` "alice"
- WHEN a `team.addMember` request is made for `userId` "alice"
- THEN the system returns a `-32602` error indicating the member already exists.

#### Scenario: add-member-invalid-role
- GIVEN an existing team
- WHEN a `team.addMember` request is made with `role` "superuser"
- THEN the system returns a `-32602` error indicating the role is invalid (must be one of: owner, admin, member).

#### Scenario: remove-member
- GIVEN an existing team with a member
- WHEN a `team.removeMember` request is made with the member's `userId`
- THEN the member is removed from the team and the team is persisted.

#### Scenario: remove-member-not-found
- GIVEN an existing team without the specified member
- WHEN a `team.removeMember` request is made
- THEN the system returns a `-32602` error indicating the member is not in the team.

### Requirement: team-persistence
The system MUST persist each team to disk as a JSON file following the same atomic-write pattern as other stores.

#### Scenario: team-persisted-on-create
- GIVEN a TeamStore initialized with a persistence directory
- WHEN a team is created
- THEN a `<teamName>.json` file exists in the teams directory.

#### Scenario: team-persisted-on-update
- GIVEN a team exists in a persistent store
- WHEN the team is updated
- THEN the corresponding JSON file reflects the updated fields.

#### Scenario: team-file-deleted-on-delete
- GIVEN a team exists in a persistent store
- WHEN the team is deleted
- THEN the corresponding JSON file is removed from disk.

#### Scenario: team-loaded-on-startup
- GIVEN a teams directory contains valid team JSON files
- WHEN a new TeamStore is initialized with that directory
- THEN all teams are loaded into memory.

#### Scenario: corrupt-team-file-skipped
- GIVEN a teams directory contains a corrupt JSON file
- WHEN a new TeamStore is initialized
- THEN the corrupt file is skipped without error and other teams load normally.

### Requirement: team-method-capabilities
The `bridge.capabilities` response MUST include all team methods in its supported methods list.

#### Scenario: capabilities-include-team-methods
- GIVEN a client calls `bridge.capabilities`
- THEN the `methods` array includes `team.create`, `team.get`, `team.update`, `team.delete`, `team.list`, `team.addMember`, and `team.removeMember`.

### Requirement: team-parameter-validation
All team JSON-RPC methods MUST validate parameter types and return `-32602` errors for invalid input.

#### Scenario: create-without-name
- GIVEN a client calls `team.create` without a `name` parameter
- WHEN the bridge validates the request
- THEN a `-32602` error is returned indicating `name` is required.

#### Scenario: create-with-duplicate-name
- GIVEN a team named "engineering" already exists
- WHEN a client calls `team.create` with `name` "engineering"
- THEN a `-32031` error is returned indicating the team already exists.

#### Scenario: add-member-without-userId
- GIVEN a client calls `team.addMember` without `userId`
- WHEN the bridge validates the request
- THEN a `-32602` error is returned indicating `userId` is required.
