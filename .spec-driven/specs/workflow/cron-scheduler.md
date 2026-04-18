---
mapping:
  implementation:
    - src/cron-scheduler.ts
    - src/bridge.ts
    - src/task-template-types.ts
    - package.json
  tests:
    - test/cron-scheduler.test.ts
---

# cron-scheduler

## Requirements

### Requirement: schedule-task-templates
The system MUST support defining a cron schedule on a task template and executing it automatically when due.

#### Scenario: trigger-scheduled-task
- GIVEN a task template with a valid cron schedule (e.g., `* * * * *`) registered in the system
- WHEN the cron schedule becomes due according to the system clock
- THEN the system MUST automatically create and start an agent session using that task template.

### Requirement: parse-cron-expressions
The system MUST parse standard cron expressions correctly.

#### Scenario: evaluate-cron-schedule
- GIVEN a cron expression provided for a task template
- WHEN it is evaluated against the current time
- THEN the system accurately determines whether the schedule is due.