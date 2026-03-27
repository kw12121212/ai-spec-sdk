# Native Executable Build

### Requirement: build:native script exists

The project MUST expose a `build:native` script in `package.json`.

### Requirement: build:native produces executable binary

Running `build:native` MUST produce a self-contained executable at `dist/ai-spec-bridge-native` (or `dist/ai-spec-bridge-native.exe` on Windows, added automatically by bun).

### Requirement: native binary is self-contained

The produced executable MUST start the JSON-RPC stdio bridge when invoked directly, without requiring a separate Node.js or Bun runtime on the target machine.

### Requirement: existing build script unchanged

The `build` script (tsc) MUST remain unchanged and continue to emit JS to `dist/`.
