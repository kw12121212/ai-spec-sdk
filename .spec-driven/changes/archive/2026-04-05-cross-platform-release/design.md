# Design: cross-platform-release

## Approach

**Native binaries:** Use `bun build --compile --target=bun-<platform>-<arch> src/cli.ts --outfile dist/ai-spec-bridge-<platform>-<arch>` for each of the 5 targets. A shell script `scripts/build-native-all.sh` loops over all targets, runs each compile, and generates a `.sha256` file next to each binary using `sha256sum` (Linux) or `shasum -a 256` (macOS). The root `package.json` gains `build:native:all` wired to this script and five individual `build:native:<target>` entries for per-platform convenience.

**SDK packaging:** A `build:pack` entry in root `package.json` calls `npm pack` in `packages/client/` (emits `ai-spec-sdk-client-<ver>.tgz`) and `python -m build --wheel` in `clients/python/` (emits `ai_spec_sdk-<ver>-py3-none-any.whl` in `clients/python/dist/`). Both packages are already buildable — this change just wires a single top-level entry point.

**Checksum portability:** The shell script uses `command -v sha256sum` with a fallback to `shasum -a 256` so the script works on both Linux CI runners and macOS developer machines.

## Key Decisions

- **Shell script over npm script chain for `build:native:all`** — a shell script can loop, handle per-platform `.exe` suffixes cleanly, and generate checksums in one place. npm script chaining across 5 platforms with conditional renaming is brittle.
- **Preserve existing `build:native` unchanged** — downstream tools or docs may already reference it; adding the multi-platform scripts alongside avoids breaking anything.
- **`python -m build --wheel` only, not sdist** — `.whl` is the installable artifact; sdist is only needed for PyPI upload which is out of scope.
- **Artifacts stay in `dist/` and `clients/python/dist/`** — consistent with existing output paths; no new top-level artifact directory.
- **No CI workflow in this change** — the roadmap notes explicitly say "local packaging, manual copy." CI runners for cross-compilation are a future concern.

## Alternatives Considered

- **GitHub Actions matrix build for native binaries** — more robust for true cross-compilation (especially Windows), but the milestone scope explicitly defers CI to a future concern. Local `bun compile --target` produces the correct binary without a CI runner for the majority of targets.
- **Single monolithic npm script for all targets** — possible with `&&` chains, but unreadable and hard to extend. Shell script is cleaner.
- **`npm pack` output moved to a top-level `artifacts/` directory** — rejected to avoid restructuring; `.tgz` in `packages/client/` and `.whl` in `clients/python/dist/` are standard tool defaults.
