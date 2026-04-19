# Design: task-dependencies

## Approach
- Enhance the task queue schema to optionally store an array of `dependsOn` task IDs.
- When enqueuing a task, the system will perform a recursive check against existing parent tasks to detect circular dependencies, rejecting the request if one is found.
- If dependencies exist and are not yet completed successfully, the task will be assigned a `blocked` status rather than `pending`.
- Modify the task worker or queue store so that when a task succeeds, it checks for any `blocked` tasks that depended on it and transitions them to `pending` if all of their dependencies are now satisfied.

## Key Decisions
- **Timing Only:** As confirmed, dependent tasks will not automatically consume the output or state of their parents. The dependency simply controls execution timing.
- **Immediate Cycle Detection:** Circular dependencies will be checked synchronously during the enqueue operation to fail fast rather than deadlocking the queue later.

## Alternatives Considered
- Passing data state from parent to child. This was rejected because it introduces complexity and coupling; timing-only dependencies are simpler and sufficient for the current needs.
