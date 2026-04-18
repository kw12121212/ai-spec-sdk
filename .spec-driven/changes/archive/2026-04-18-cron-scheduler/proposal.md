# cron-scheduler

## What
Implement cron-based scheduled task execution for agent task templates.

## Why
With the task template registry and team registry complete, we need the ability to run these predefined tasks autonomously on a schedule. This provides immediate value for periodic background jobs and serves as the foundation for asynchronous execution.

## Scope
- Add a background scheduler to evaluate cron expressions and trigger task template instantiation into active sessions.
- In-memory execution tracking (persistent tracking is deferred to a future queue milestone).
- Use `cron-parser` to robustly evaluate standard cron expressions.
- Start scheduled tasks by launching an agent session.

## Unchanged Behavior
- Existing task templates without cron schedules will not be executed automatically.
- Task template retrieval, updates, and deletions will remain unaffected.
- Session execution semantics for manually triggered sessions will not change.
