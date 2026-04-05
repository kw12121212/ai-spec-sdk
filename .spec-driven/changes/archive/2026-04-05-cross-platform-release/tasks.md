# Tasks: cross-platform-release

## Implementation

- [x] Add `build:native:linux-x64`, `build:native:linux-arm64`, `build:native:macos-x64`, `build:native:macos-arm64`, `build:native:windows-x64` scripts to root `package.json`, each running `bun build --compile --target=bun-<target> src/cli.ts --outfile dist/ai-spec-bridge-<target>`
- [x] Add `build:native:all` script to root `package.json` wired to `bash scripts/build-native-all.sh`
- [x] Create `scripts/build-native-all.sh` that compiles all 5 targets and generates a `.sha256` file next to each binary (using `sha256sum` with `shasum -a 256` fallback)
- [x] Add `build:pack` script to root `package.json` that runs `npm pack` in `packages/client/` and `python -m build --wheel` in `clients/python/`

## Testing

- [x] Run `bun run lint` and confirm no TypeScript errors
- [x] Run `bun run build:native` (existing single-platform) and confirm `dist/ai-spec-bridge-native` is produced unchanged
- [x] Run `bun run build:native:linux-x64` and confirm `dist/ai-spec-bridge-linux-x64` is produced
- [x] Run `bash scripts/build-native-all.sh` and confirm all 5 binaries and their `.sha256` files are produced in `dist/`
- [x] Run `bun run build:pack` and confirm a `.tgz` artifact appears in `packages/client/` and a `.whl` appears in `clients/python/dist/`
- [x] Run `bun test` and confirm all existing tests still pass

## Verification

- [x] `dist/` contains `ai-spec-bridge-linux-x64`, `ai-spec-bridge-linux-arm64`, `ai-spec-bridge-macos-x64`, `ai-spec-bridge-macos-arm64`, `ai-spec-bridge-windows-x64.exe` plus one `.sha256` per binary
- [x] `bun run build:pack` output includes a `.tgz` (TS client) and `.whl` (Python client) with no errors
- [x] `bun run build` (tsc) still passes without modification
- [x] Existing `build:native` script still works and output path is unchanged
