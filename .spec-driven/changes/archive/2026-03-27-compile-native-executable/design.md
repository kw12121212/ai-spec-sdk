# Design: compile-native-executable

## Approach

Use `bun build --compile src/cli.ts --outfile dist/ai-spec-bridge-native` to produce the executable.

Bun's `--compile` flag bundles the entire dependency graph (including `@anthropic-ai/claude-agent-sdk`) and generates a platform-native binary that embeds a minimal Bun runtime. The result is a single file with no external runtime dependency.

## Key Decisions

**bun `--compile` over pkg/nexe/esbuild+sea**: bun is already the project's package manager; using its built-in `--compile` keeps the toolchain uniform with zero new dev dependencies.

**Output path `dist/ai-spec-bridge-native`**: Keeps compiled output alongside other `dist/` artefacts. `.gitignore` updated to exclude it.

**Smoke test gated on `NATIVE_BUILD_TEST=1`**: The compile step takes several seconds; hiding it behind an env var keeps `bun test` fast for everyday use while still allowing CI or manual verification.

## Alternatives Considered

- **pkg / nexe**: Would require a new dev dependency. Bun's built-in is equivalent in this context.
- **Cross-compilation flags**: `bun build --compile --target=bun-linux-x64` etc. Deferred — not in scope.
- **Shebang installation to PATH**: Out of scope; left to downstream tooling or users.
