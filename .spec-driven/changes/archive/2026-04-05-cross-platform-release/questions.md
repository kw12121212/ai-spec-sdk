# Questions: cross-platform-release

## Open

<!-- No open questions -->

## Resolved

- [x] Q: Does the Python client SDK source already exist, or does `build:pack` only produce a stub?
  Context: The roadmap mentions `python -m build` but the spec for python-client-sdk exists without a corresponding archived change.
  A: Confirmed at scaffold time — `clients/python/` exists with `pyproject.toml` (hatchling backend) and `src/` directory. Both clients are implemented. Pack scripts wire the existing sources.

- [x] Q: Is CI the primary delivery path, or should scripts run locally on a single platform?
  Context: Multi-platform bun compile is most reliable on a matching CI runner, but the roadmap notes say "local packaging, manual copy."
  A: Local-only per roadmap notes. Scripts run on the developer's machine. `bun compile --target` cross-compilation handles the binary generation without requiring platform-specific runners.

- [x] Q: Should Windows `.exe` extension be handled explicitly in scripts?
  Context: `bun compile` adds `.exe` automatically on Windows but not when cross-compiling for Windows from another OS.
  A: Windows target output is named `dist/ai-spec-bridge-windows-x64.exe` explicitly in the `--outfile` flag so the name is consistent regardless of host platform.
