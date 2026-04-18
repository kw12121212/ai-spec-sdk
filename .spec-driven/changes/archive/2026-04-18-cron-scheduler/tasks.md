# Tasks

## Implementation
- [x] Add `cron-parser` to dependencies in `package.json` and run `bun install`.
- [x] Add `cronSchedule?: string` property to the `TaskTemplate` interface in `src/task-template-types.ts`.
- [x] Create `src/cron-scheduler.ts` with a `CronScheduler` class that periodically checks task templates for due cron schedules.
- [x] Update `src/index.ts` or `src/cli.ts` to start the `CronScheduler` when the server starts.

## Testing
- [x] Write unit tests in `test/cron-scheduler.test.ts` to verify scheduling logic (mocking the clock/store).
- [x] Add a unit test to verify that task templates with `cronSchedule` are parsed correctly.
- [x] Run `bun run test` to verify all unit tests pass.
- [x] Run `bun run lint` to ensure linting and type-checking pass.

## Verification
- [x] Ensure that a task template with a schedule of `* * * * *` starts an agent session every minute while the server is running.
