# Task and Team Registry

## Goal
Enable collaborative agent workflows through task templates, team registries, and scheduled job execution with cron support.

## In Scope
- Task template registry for reusable agent configurations
- Team registry for shared workspaces and permissions
- Cron-based scheduled task execution
- Task queue management with priority and retry
- Cross-session task dependencies and orchestration
- Team-level resource quotas and usage tracking

## Out of Scope
- Visual workflow designer or DAG editor
- Real-time collaborative editing
- External CI/CD system integration

## Done Criteria
- Task templates can be saved, versioned, and instantiated
- Teams can be created with members and shared resources
- Cron schedules trigger agent executions reliably
- Task queues handle priorities and retries correctly
- Resource quotas are enforced at team level

## Planned Changes
- `task-template-registry` - Declared: complete - save and version task templates
- `team-registry` - Declared: complete - team management and membership
- `cron-scheduler` - Declared: complete - scheduled task execution
- `task-queue` - Declared: planned - priority queue with retry logic
- `task-dependencies` - Declared: planned - cross-session task orchestration
- `team-quotas` - Declared: planned - resource limits per team

## Dependencies
- 07-agent-lifecycle — leverages agent state management for task execution
- 09-permissions-hooks — integrates with RBAC for team permissions
- 14-persistence-cache — requires persistent storage for registries

## Risks
- Cron scheduling requires reliable timekeeping across restarts
- Task queue persistence must handle crash recovery
- Team quotas need careful accounting to prevent overuse

## Status
- Declared: proposed

## Notes




