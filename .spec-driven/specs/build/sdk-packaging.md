---
mapping:
  implementation:
    - package.json
  tests: []
---
# SDK Packaging

### Requirement: build:pack script exists

The project MUST expose a `build:pack` script in the root `package.json`.

### Requirement: build:pack produces a TypeScript client tgz

Running `build:pack` MUST produce an npm-installable `.tgz` artifact for the `@ai-spec-sdk/client` package (via `npm pack` in `packages/client/`).

### Requirement: build:pack produces a Python client wheel

Running `build:pack` MUST produce a Python-installable `.whl` artifact for the `ai-spec-sdk` package (via `python -m build --wheel` in `clients/python/`), output to `clients/python/dist/`.

### Requirement: artifacts are installable locally without a registry

The `.tgz` artifact MUST be installable with `npm install ./path/to/artifact.tgz`. The `.whl` artifact MUST be installable with `pip install ./path/to/artifact.whl`. No registry access is required.
