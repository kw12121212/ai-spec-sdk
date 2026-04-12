# Tasks: execution-hooks

## Implementation

- [x] Add `spawn` import from `child_process` in bridge.ts
- [x] Modify `_fireHooks` to spawn hook commands for all matching hooks
- [x] Implement blocking execution for `pre_tool_use` hooks (await completion before proceeding)
- [x] Implement non-blocking fire-and-forget execution for `post_tool_use`, `notification`, `stop`, `subagent_stop` hooks
- [x] Capture hook execution result (exitCode, stdout, stderr, durationMs, timedOut)
- [x] Extend `bridge/hook_triggered` notification to include execution result fields
- [x] Add 30-second default timeout enforcement with process kill on timeout
- [x] Abort tool use when a blocking `pre_tool_use` hook exits non-zero
- [x] Execute multiple blocking hooks sequentially; stop chain on first non-zero exit
- [x] Pass workspace directory as cwd for spawned hook processes

## Testing

- [x] Run `bun run lint` and verify no type errors
- [x] Run `bun run test` and verify all existing tests still pass
- [x] Add unit test to `test/` and run `bun run test` for: blocking pre_tool_use hook that exits 0 allows tool use to proceed
- [x] Add unit test to `test/` and run `bun run test` for: blocking pre_tool_use hook that exits 1 aborts tool use
- [x] Add unit test to `test/` and run `bun run test` for: non-blocking hooks fire without awaiting
- [x] Add unit test to `test/` and run `bun run test` for: hook execution timeout kills process after 30s
- [x] Add unit test to `test/` and run `bun run test` for: multiple blocking hooks execute sequentially, chain stops on failure
- [x] Add unit test to `test/` and run `bun run test` for: hook notification includes exitCode, stdout, stderr, durationMs
- [x] Run `bun run lint` after implementation to confirm no regressions
- [x] Run `bun run test` after adding new tests to confirm all pass

## Verification

- [x] Verify implementation matches proposal.md scope (no feature creep)
- [x] Verify delta spec in specs/hooks/hook-execution.md aligns with implemented behavior
- [x] Verify unchanged behaviors: hook registration, removal, listing, file persistence all work as before
- [x] Verify no regressions in existing bridge tests (session start, resume, stop, tool use)
