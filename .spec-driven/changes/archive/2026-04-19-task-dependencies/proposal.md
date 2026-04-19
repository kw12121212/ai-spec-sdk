# Proposal: task-dependencies

## What
Implement cross-session task orchestration by adding task dependencies to the task queue. Tasks can be enqueued with a list of parent task IDs they depend on, and they will only transition to a runnable state once all their parent tasks have successfully completed.

## Why
This change fulfills the "task-dependencies" planned item in the `10-task-team-registry.md` milestone. It enables complex, multi-step, and multi-agent workflows across sessions, moving toward the core goal of collaborative agent orchestration.

## Scope
- Update task enqueuing to accept a list of parent task IDs.
- Introduce a `blocked` or `waiting` status for tasks with pending dependencies.
- Implement explicit circular dependency checking upon task enqueueing.
- Ensure dependent tasks execute only after parent tasks complete successfully (purely timing/execution dependency; no data passing is needed).

## Unchanged Behavior
- Tasks without dependencies will continue to be enqueued and executed exactly as before.
- Task queue priority and retry logic remain unaffected.
