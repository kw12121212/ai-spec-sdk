# cross-platform-release

## What

Extend the bridge CLI build to produce native self-contained binaries for five target platforms (linux-x64, linux-arm64, macos-x64, macos-arm64, windows-x64) via `bun compile`. Add a `build:pack` script to the root `package.json` that packages the TypeScript client (`npm pack`) and Python client (`python -m build`) into installable local artifacts. Each native binary gets a SHA-256 checksum file alongside it.

## Why

Milestones 01 and 02 delivered a working bridge, but distribution is currently platform-locked — consumers must have Bun installed and build from source. This change makes the bridge distributable as single-file binaries and both client SDKs distributable as local packages, enabling manual hand-off without any registry dependency.

## Scope

- Per-platform `build:native:<target>` scripts in root `package.json` using `bun build --compile --target=bun-<target>`
- A `build:native:all` script (shell script at `scripts/build-native-all.sh`) that runs all 5 targets and generates `<binary>.sha256` files
- Output naming: `dist/ai-spec-bridge-linux-x64`, `dist/ai-spec-bridge-linux-arm64`, `dist/ai-spec-bridge-macos-x64`, `dist/ai-spec-bridge-macos-arm64`, `dist/ai-spec-bridge-windows-x64.exe`
- A `build:pack` script in root `package.json` that runs `npm pack` in `packages/client/` and `python -m build` in `clients/python/`, producing `.tgz` and `.whl` artifacts
- Delta spec: extend `build/native-executable.md` for multi-platform targets; add `build/sdk-packaging.md` for pack scripts

Out of scope:
- Publishing to npm or PyPI
- GitHub Actions / CI workflow changes (binaries are built locally)
- Changes to bridge source code, JSON-RPC surface, or client SDK source

## Unchanged Behavior

- The existing `build:native` script (no target flag) is kept unchanged and continues to produce `dist/ai-spec-bridge-native`
- `build` (tsc), `test`, `lint`, and `start` scripts are unaffected
- No bridge runtime behavior changes; no JSON-RPC surface changes
- No changes to `packages/client/` or `clients/python/` source code
