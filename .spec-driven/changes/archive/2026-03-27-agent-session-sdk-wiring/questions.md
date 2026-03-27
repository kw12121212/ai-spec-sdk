# Questions: agent-session-sdk-wiring

## Open

<!-- No open questions -->

## Resolved

- [x] Q: If the caller passes `cwd` inside `options`, should the bridge reject with an error or silently ignore it?
  Context: `cwd` is bridge-managed (derived from `workspace`). Caller confusion would be silent and hard to debug.
  A: Reject with `-32602`.

- [x] Q: When translating proxy params to SDK `env`, should bridge replace the entire `env` or merge proxy entries into it?
  Context: Caller may need to pass other env vars alongside proxy settings.
  A: Merge — proxy entries overwrite matching keys in caller-provided `options.env`, other keys are preserved.
