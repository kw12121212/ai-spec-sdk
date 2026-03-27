# compile-native-executable

## What

Add a `build:native` script that uses `bun build --compile` to produce a single self-contained native executable (`dist/ai-spec-bridge-native`) from the CLI entry point (`src/cli.ts`). The executable bundles all dependencies and requires no Node.js or Bun runtime on the target machine.

## Why

The SDK currently ships a JS bundle that requires a Node.js runtime. A native executable lowers the distribution bar — users can drop one binary onto a machine without installing any runtime, which is especially useful for CI environments and downstream tools embedding the bridge.

## Scope

**In scope:**
- Add `build:native` npm script using `bun build --compile`
- Output target: `dist/ai-spec-bridge-native` (no extension on Linux/macOS; `.exe` is added automatically by bun on Windows)
- Update `.gitignore` to exclude the compiled binary
- Add a smoke-test that builds the executable and runs `--version` or a trivial probe to confirm the binary is functional

**Out of scope:**
- Cross-compilation for other architectures / OSes
- CI/CD pipeline changes
- Installer scripts or packaging (zip, deb, etc.)
- Changing the existing `build` or `start` scripts

## Unchanged Behavior

Behaviors that must not change as a result of this change:
- Existing `build` script (`tsc`) continues to produce `dist/` JS output unchanged
- `start` script continues to launch `dist/src/cli.js` unchanged
- All existing tests continue to pass
- The `ai-spec-bridge` npm bin entry continues to resolve to `dist/src/cli.js`
