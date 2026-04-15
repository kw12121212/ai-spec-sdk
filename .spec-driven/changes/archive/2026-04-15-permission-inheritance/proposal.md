# Proposal: permission-inheritance

## What
Implement parent-child permission propagation for multi-agent workflows. When a child session is spawned, it will inherit the permission scopes and policies of its parent session.

## Why
This fulfills a key goal of the "Permissions Model and Execution Hooks" milestone. As multi-agent coordination allows parent sessions to spawn children, those children must operate within the same or stricter security boundaries to prevent privilege escalation.

## Scope
- Modify `session.spawn` to calculate and enforce the intersection of parent and child `allowedScopes`.
- Modify `session.spawn` to calculate and enforce the union of parent and child `blockedScopes`.
- Propagate the parent's registered `PermissionPolicy` instances to the child session.
- Reject requests to `session.spawn` where the requested `allowedScopes` contain items not present in the parent's `allowedScopes` (if the parent restricts scopes).

## Unchanged Behavior
- Root sessions (sessions started via `session.start` without a parent) will continue to initialize scopes and policies exactly as they do today.
- Existing policy evaluation and scope checking logic during tool execution remains unchanged.
