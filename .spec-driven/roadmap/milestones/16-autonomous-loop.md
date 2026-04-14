# Autonomous Loop Driver

## Goal
Implement a self-driving development loop that automatically executes roadmap changes through recommend → auto workflow, with context lifecycle management and automatic question handling.

## In Scope
- Loop scheduler that reads roadmap state and selects next change
- Recommend → Auto execution pipeline (propose → implement → verify → review → archive)
- Context lifecycle management with automatic session restart on token limit
- Integration with Answer Agent for automatic question resolution
- Human escalation gate for unsolvable problems
- Progress persistence and crash recovery
- Loop control interface (start, pause, resume, stop)

## Out of Scope
- Roadmap/milestone creation (prerequisite)
- Multi-loop coordination across distributed systems
- AI-driven roadmap planning

## Done Criteria
- Loop automatically executes changes based on roadmap recommendations
- Context window exhaustion triggers graceful session restart with state preservation
- Questions are automatically answered without human intervention when possible
- Unsolvable problems escalate to human with full context
- Progress is persisted and recoverable after crashes
- Loop can be controlled via API (start, pause, resume, stop)

## Planned Changes
- `loop-scheduler` - Declared: planned - roadmap state reading and change selection
- `recommend-auto-pipeline` - Declared: planned - automated change execution
- `context-lifecycle-manager` - Declared: planned - token tracking and session restart
- `answer-agent-integration` - Declared: planned - automatic question handling
- `escalation-gate` - Declared: planned - human escalation for unsolvable issues
- `loop-persistence` - Declared: planned - progress tracking and crash recovery
- `loop-control-api` - Declared: planned - runtime control interface

## Dependencies
- 07-agent-lifecycle — leverages agent state management
- 10-task-team-registry — uses task scheduling infrastructure
- 13-question-resolution — integrates with question handling
- 14-persistence-cache — requires state persistence

## Risks
- Automatic execution may produce unexpected changes; need safeguards
- Context restart must preserve exact execution state
- Answer Agent accuracy affects loop reliability

## Status
- Declared: proposed

## Notes

