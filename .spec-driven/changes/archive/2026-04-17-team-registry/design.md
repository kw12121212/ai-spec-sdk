# Design: team-registry

## Approach

Follow the established store pattern (as used by `TaskTemplateStore`, `WorkspaceStore`, `RoleStore`):

1. **Types file** (`src/team-types.ts`): Define `Team`, `TeamMember`, `CreateTeamParams`, `UpdateTeamParams` interfaces
2. **Store file** (`src/team-store.ts`): Implement `TeamStore` class with in-memory `Map<string, Team>` and optional file persistence via the atomic-write-to-tmp-then-rename pattern
3. **Bridge integration** (`src/bridge.ts`): Register seven new JSON-RPC methods in the switch statement with parameter validation
4. **Capabilities** (`src/capabilities.ts`): Advertise all team methods

The store uses team name as the unique key (consistent with `TaskTemplateStore`). Each team stores a members array with role information and a workspaces array.

## Key Decisions

1. **Team name as primary key** — Consistent with the `TaskTemplateStore` pattern where human-readable names serve as identifiers. Avoids introducing a UUID dependency.

2. **Member roles: owner, admin, member** — A simple three-tier model. The creator is automatically assigned the `owner` role. This is sufficient for the current milestone without overcomplicating the design.

3. **File-based persistence** — Uses the same JSON-per-item pattern as other stores. Team data is stored in `<sessionsDir>/teams/<teamName>.json`. This avoids introducing new storage dependencies while the persistence-cache milestone (14) is not yet complete.

4. **No team-scoped session filtering in this change** — Sessions remain workspace-scoped. Team-to-session association is deferred to a future change to keep scope focused.

5. **Validation of member roles against RBAC roles is not coupled** — Team member roles (`owner`/`admin`/`member`) are internal to the team concept and independent from the RBAC scope roles defined in `roles.yaml`. This avoids conflating two different authorization models.

## Alternatives Considered

1. **UUID-based team identifiers** — Considered but rejected to maintain consistency with the existing `TaskTemplateStore` name-keyed pattern. Names are more ergonomic for a CLI/SDK use case.

2. **Single workspace per team** — Considered for simplicity but rejected; real collaborative workflows often involve multiple related workspaces per team.

3. **Database-backed storage** — Rejected because the project uses file-based persistence throughout. The persistence-cache milestone (14) may introduce pluggable backends later.

4. **Embedding members in the bridge constructor** — Considered but rejected in favor of the standalone `TeamStore` class pattern, which allows independent testing and future composition.
