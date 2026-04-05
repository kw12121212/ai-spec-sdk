## ADDED Requirements

### Requirement: per-platform build scripts exist

The project MUST expose `build:native:linux-x64`, `build:native:linux-arm64`, `build:native:macos-x64`, `build:native:macos-arm64`, and `build:native:windows-x64` scripts in `package.json`.

### Requirement: per-platform scripts produce correctly named binaries

Each `build:native:<target>` script MUST produce a self-contained executable at `dist/ai-spec-bridge-<target>`. The Windows target MUST produce `dist/ai-spec-bridge-windows-x64.exe`.

### Requirement: build:native:all script compiles all five targets

The project MUST expose a `build:native:all` script that compiles all five platform targets and generates a SHA-256 checksum file (`<binary>.sha256`) alongside each binary.

### Requirement: checksum files are generated for all native binaries

Running `build:native:all` MUST produce one `.sha256` file per binary, named `<binary-filename>.sha256`, containing the hex digest of that binary.

### Requirement: existing build:native script is unchanged

The existing `build:native` script (no target flag, output at `dist/ai-spec-bridge-native`) MUST remain present and unchanged.
