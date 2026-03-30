## Approach

1. **Update `capabilities.ts`**: Add `spec-driven-maintenance` to `BUILTIN_SPEC_SKILLS`, add `maintenance` and `migrate` to `SUPPORTED_WORKFLOWS`, update `WORKFLOW_SKILL_MAP`. Replace flat string arrays with structured `SkillInfo` objects containing name, description, hasScript, and parameters.

2. **Update `bridge.ts` dispatch**: The `skills.list` handler changes from returning `{ skills: BUILTIN_SPEC_SKILLS }` (string array) to `{ skills: BUILTIN_SPEC_SKILLS }` where each entry is a `SkillInfo` object. No new dispatch methods needed — `workflow.run` already handles arbitrary workflow names.

3. **Update `workflow.ts`**: The `SUPPORTED_WORKFLOWS` check already gates execution, so adding `maintenance` and `migrate` there automatically enables them. The `maintenance` workflow maps to `run-maintenance` script subcommand.

4. **Update specs**: Three delta spec files reflecting the enriched skill metadata and new workflows.

5. **Update tests**: Adjust `bridge.test.ts` for the new `skills.list` response shape. Add `workflow.test.ts` cases for `maintenance` and `migrate`.

## Key Decisions

- **Breaking change to `skills.list` response format**: Changed from `string[]` to `SkillInfo[]`. This is intentional — downstream consumers (Go CLI) will be updated in the same change. The bridge version bumps from `0.1.0` to `0.2.0` to signal this.
- **`maintenance` workflow name vs `run-maintenance` script**: The workflow is exposed as `maintenance` (user-facing), but maps to the `run-maintenance` script subcommand internally. This keeps workflow names clean and noun-based.
- **AI-only skills get `hasScript: false`**: Skills like `brainstorm`, `auto`, `review`, and `spec-content` don't have backing scripts, so `hasScript: false` signals to callers that they can't be invoked via `workflow.run`.
- **`parameters` field**: For script-backed skills, this lists the script arguments (e.g., `<change>` for apply). For AI-only skills, this is an empty array.

## Alternatives Considered

- **Keep `skills.list` flat + add `skills.info` method**: Would avoid breaking change but adds a second round-trip for clients that need descriptions. Rejected because the skill count is small (12) and the overhead of a richer single response is negligible.
- **Add `maintenance` as a session sub-command**: The maintenance workflow doesn't need agent sessions — it runs lint/test/fix commands directly. Using `workflow.run` is the correct abstraction.
