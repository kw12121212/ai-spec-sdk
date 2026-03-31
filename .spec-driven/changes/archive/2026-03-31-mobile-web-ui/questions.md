# Questions: mobile-web-ui

## Open

<!-- No open questions -->

## Resolved

- [x] Q: Should tool approval be in scope for v1?
  Context: Tool approval requires handling `bridge/tool_approval_requested` notifications and calling `session.approveTool`/`session.rejectTool`. The bridge already supports these methods.
  A: Yes, in scope. Bridge already supports approveTool/rejectTool.

- [x] Q: Single HTML file or separate files in src/ui/?
  Context: Single file is simplest to serve; separate files improve code organization.
  A: Single HTML file with inline CSS/JS.

- [x] Q: Serve at `GET /` or `GET /ui/`?
  Context: Root path is simplest for mobile users; sub-path keeps root available for future use.
  A: `GET /`.

- [x] Q: Default permissionMode for the UI?
  Context: Bridge defaults to `bypassPermissions`, but a UI-facing user might expect safety prompts.
  A: `bypassPermissions` — consistent with bridge default. Users can select a stricter mode.

- [x] Q: Workspace selector — free text only, or list picker?
  Context: Free text is simplest; a list picker from `workspace.list` is more user-friendly.
  A: Both — free text input with optional list picker via `workspace.list`.
