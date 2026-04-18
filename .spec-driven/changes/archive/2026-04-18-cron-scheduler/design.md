# cron-scheduler Design

## Approach
We will introduce a `CronScheduler` class that periodically ticks (e.g., every minute) to check which task templates have cron schedules due for execution.
To evaluate the cron expression against the current time, we will utilize the `cron-parser` library.
When a schedule is due, the scheduler will retrieve the task template from the `TaskTemplateStore` and start a new agent session using the `AgentStateMachine` or `SessionStore`.
The scheduler will run in-memory, meaning if the process restarts, it will only trigger tasks scheduled from that point onward (no retrospective catch-up).

## Key Decisions
- **In-memory Tracking:** We decided to keep the state in-memory. Missing a run during a restart is acceptable for this initial milestone; durable, persistent queues will be introduced later.
- **Third-party Library:** We will use `cron-parser` for cron evaluation. Cron parsing is notoriously tricky with many edge cases, and a library provides immediate robustness.
- **Polling vs. Timers:** We will use a regular polling interval (e.g., `setInterval` every minute) rather than setting thousands of individual `setTimeout` calls, which scales better and is easier to manage when schedules change.

## Alternatives Considered
- **Persistent Scheduler:** We considered storing the "last run time" in the database/file system. We rejected this to reduce complexity and defer persistence to the upcoming `task-queue` change.
- **Custom Cron Parser:** We considered building our own parser to minimize dependencies. We rejected this due to the complexity and edge cases in cron syntax.
