# Questions: sync-spec-driven-interfaces

## Open

<!-- No open questions -->

## Resolved

- [x] Q: Should `skills.list` return flat names or structured metadata?
  Context: GUI clients need descriptions and parameter info to present actionable UI
  A: Return structured `SkillInfo[]` with name, description, hasScript, and parameters

- [x] Q: How should `maintenance` workflow map to the script command?
  Context: The script command is `run-maintenance`, but the workflow name should be user-friendly
  A: Expose as `maintenance` in the workflow API, map to `run-maintenance` script internally

- [x] Q: Should `migrate` be a workflow even though it has no corresponding skill?
  Context: `migrate` is a script command that converts OpenSpec artifacts to spec-driven format
  A: Yes, add as a workflow since `workflow.run` is the bridge's mechanism for invoking scripts
