---
implementation:
  - src/bridge.ts
tests:
  - test/hook-audit.test.ts
---

# Delta Specification: hook-execution.md

## ADDED Requirements

### Requirement: Hook Execution Audit Trail

In addition to emitting `bridge/hook_triggered` notifications, the bridge MUST write a `hook_execution` audit entry via the `AuditLog` instance for every hook command execution.

The audit entry MUST be written regardless of whether the hook is blocking or non-blocking. For blocking hooks, the entry is written after the command completes (with final exitCode, stdout, stderr, durationMs). For non-blocking hooks, two entries are written: one immediate entry with pending values (exitCode null, durationMs null) and one completion entry with final values.

The audit entry payload MUST include all fields from the `bridge/hook_triggered` notification plus the `hookId` and `matcher` if available.

#### Scenario: Hook audit entry mirrors hook_triggered notification
- GIVEN a pre_tool_use hook executes and exits with code 0
- WHEN the hook completes
- THEN both a bridge/hook_triggered notification AND a hook_execution audit entry are produced
- AND both contain matching exitCode, durationMs, and command values

#### Scenario: Non-blocking hook produces two audit entries
- GIVEN a post_tool_use hook (non-blocking) is triggered
- WHEN the event fires
- THEN an audit entry with exitCode null is written immediately
- AND a second audit entry with final exitCode is written when the hook process exits
