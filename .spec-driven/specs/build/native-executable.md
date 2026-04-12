---
mapping:
  implementation:
    - package.json
  tests:
    - test/native-build.test.ts
---
# Native Executable Build

### Requirement: build:native script exists

The project MUST expose a `build:native` script in `package.json`.

### Requirement: build:native produces executable binary

Running `build:native` MUST produce a self-contained executable at `dist/ai-spec-bridge-native` (or `dist/ai-spec-bridge-native.exe` on Windows, added automatically by bun).

### Requirement: native binary is self-contained

The produced executable MUST start the JSON-RPC stdio bridge when invoked directly, without requiring a separate Node.js or Bun runtime on the target machine.

### Requirement: existing build script unchanged

The `build` script (tsc) MUST remain unchanged and continue to emit JS to `dist/`.

### Requirement: per-platform build scripts exist

The project MUST expose `build:native:linux-x64`, `build:native:linux-arm64`, `build:native:macos-x64`, `build:native:macos-arm64`, and `build:native:windows-x64` scripts in `package.json`.

### Requirement: per-platform scripts produce correctly named binaries

Each `build:native:<target>` script MUST produce a self-contained executable at `dist/ai-spec-bridge-<target>`. The Windows target MUST produce `dist/ai-spec-bridge-windows-x64.exe`.

### Requirement: build:native:all script compiles all five targets

The project MUST expose a `build:native:all` script that compiles all five platform targets and generates a SHA-256 checksum file (`<binary>.sha256`) alongside each binary.

### Requirement: checksum files are generated for all native binaries

Running `build:native:all` MUST produce one `.sha256` file per binary, named `<binary-filename>.sha256`, containing the hex digest of that binary.
