# agent-state-machine

## What

Define an extended agent execution state machine with states (idle, running, paused, waiting_for_input, error, completed), valid transition rules, and transition events. This change introduces the state machine as an internal contract only — no new JSON-RPC methods are exposed.

## Why

Milestone 07 (Agent Lifecycle Deep Management) is the most-depended-upon planned milestone, with 6 other milestones referencing it. The state machine is the foundational contract that `execution-hooks`, `pause-resume`, `timeout-cancellation`, and `audit-logging` all build upon. Defining it first unblocks the widest range of downstream work.

## Scope

- Define `AgentExecutionState` type with values: `idle`, `running`, `paused`, `waiting_for_input`, `error`, `completed`
- Define valid state transitions as a transition table
- Add `executionState` field to the `Session` interface (distinct from existing `status` persistence field)
- Emit transition events on state changes
- Map existing operations (`session.start`, `session.stop`, query completion) to execution state transitions
- Preserve existing `status` field semantics unchanged (`active | completed | stopped | interrupted`)

## Unchanged Behavior

- Existing `status` field values and persistence behavior remain identical
- `session.start`, `session.stop`, `session.resume` RPC methods retain current signatures and semantics
- Disk persistence format does not change (new `executionState` field will be persisted alongside existing fields)
- Cascade stop behavior for parent-child sessions is unchanged
- Interrupted-on-restart recovery logic is unchanged
