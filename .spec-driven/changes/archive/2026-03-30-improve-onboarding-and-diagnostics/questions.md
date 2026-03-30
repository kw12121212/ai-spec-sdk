# Questions: improve-onboarding-and-diagnostics

## Open

<!-- No open questions -->

## Resolved

- [x] Q: How should the current version mismatch be resolved?
  Context: `package.json` still reports `0.1.0`, while the runtime bridge already reports `0.2.0`.
  A: Bump the package version up so published metadata matches the runtime bridge and API version.

- [x] Q: What output mode should `ai-spec-bridge doctor` use?
  Context: Humans need a readable diagnostic summary, but scripts also need machine-readable output.
  A: Default to human-readable output and also support `--json`.
