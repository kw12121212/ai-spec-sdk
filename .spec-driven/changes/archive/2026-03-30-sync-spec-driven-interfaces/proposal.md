# sync-spec-driven-interfaces

## What

Synchronize the bridge's spec-driven skill and workflow interfaces with the upgraded auto-spec-driven framework (12 skills, new scripts: `migrate`, `run-maintenance`). Enrich `skills.list` to return structured metadata per skill instead of a flat name array.

## Why

The upstream `auto-spec-driven` repository has added a new skill (`spec-driven-maintenance`) and two new script commands (`migrate`, `run-maintenance`). The bridge currently only lists 11 skills and 8 workflows, so callers cannot discover or invoke the new capabilities. Additionally, `skills.list` returns only skill names — GUI clients need descriptions, parameter info, and script availability to present actionable UI without hard-coding knowledge.

## Scope

- Add `spec-driven-maintenance` to the built-in skill registry (12 total)
- Add `maintenance` and `migrate` to supported workflows (10 total)
- Update `WORKFLOW_SKILL_MAP` with new entries
- Change `skills.list` response from `string[]` to `SkillInfo[]` where each entry has `name`, `description`, `hasScript`, and `parameters`
- Update `bridge.capabilities` to reflect new methods and updated `skills.list` contract
- Update delta specs for: `skills/builtin-spec-skills.md`, `workflow/spec-driven-workflows.md`, `bridge/json-rpc-stdio.md`
- Update existing tests and add tests for new workflows and enriched skills.list

## Unchanged Behavior

- All existing 11 skills remain listed (no removals or renames)
- All existing 8 workflows remain supported (no changes to their invocation)
- `workflow.run` error handling, notification, and result structure stay the same
- AI-only skills (brainstorm, auto, review, spec-content) remain in the skill list with `hasScript: false`
- `bridge.ping`, session methods, MCP methods, config, hooks, context methods are unchanged
