# team-registry

## What

Add a team registry to the bridge that supports creating, reading, updating, deleting, and listing teams with members and shared workspace associations. Teams serve as organizational units for collaborative agent workflows and provide a scope for team-level permissions and (future) resource quotas.

## Why

Milestone 10 (Task and Team Registry) requires team management as a foundational capability. The `task-template-registry` change established reusable task configurations; teams complement this by providing shared workspaces where members can collaborate on agent sessions. The RBAC system (milestone 09) already defines roles and scopes; teams extend this to group-level permission scoping. Team registry is also a prerequisite for the planned `team-quotas` change.

## Scope

**In scope:**
- Team CRUD: create, get, update, delete, list teams
- Team member management: add/remove members with roles (owner, admin, member)
- Team workspace association: link one or more workspaces to a team
- JSON-RPC methods: `team.create`, `team.get`, `team.update`, `team.delete`, `team.list`, `team.addMember`, `team.removeMember`
- File-based persistence following the existing store pattern (JSON files per team)
- Capability advertisement for all new methods
- Integration with existing RBAC system for team role validation

**Out of scope:**
- Team-level resource quotas (separate `team-quotas` change)
- Team-scoped session filtering or restrictions
- Real-time member presence or notifications
- Team invitation workflow or email integration
- Audit logging for team operations (can be added separately)

## Unchanged Behavior

- Existing task template operations remain unchanged
- Session management (start, resume, stop, etc.) remains unchanged
- RBAC scope checking and role resolution remain unchanged
- Existing bridge methods and capabilities remain unchanged
- Workspace registration and configuration management remain unchanged
