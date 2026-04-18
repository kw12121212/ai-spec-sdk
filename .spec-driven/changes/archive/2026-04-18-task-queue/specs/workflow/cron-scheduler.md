---
mapping:
  implementation:
    - src/cron-scheduler.ts
  tests:
    - test/cron-scheduler.test.ts
---

## MODIFIED Requirements

### Requirement: schedule-task-templates
Previously: The system MUST support defining a cron schedule on a task template and executing it automatically when due.
The system MUST support defining a cron schedule on a task template and automatically enqueuing it into the task queue when due.
