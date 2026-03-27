# Design: add-helper-scripts

## Approach

Create standalone bash scripts in `scripts/` that wrap existing `bun run` commands from package.json. Each script:
- Uses `set -euo pipefail` for strict error handling
- Detects the project root via script location (`scripts/` is always at project root)
- Delegates to `bun run` commands already defined in package.json
- Prints a summary line on completion

## Key Decisions

1. **Scripts delegate to `bun run`** rather than duplicating commands — keeps build logic in package.json as single source of truth
2. **No shebang `#!/usr/bin/env bash`** — these are sourced or run explicitly, not installed to PATH
3. **Minimal output** — scripts print only what's needed (errors + a done line), letting the underlying tools produce their own output

## Alternatives Considered

- **Makefile**: More powerful but adds a build tool dependency; overkill for 4 simple scripts
- **Just (command runner)**: Same issue — adds a dependency for trivial wrapping
- **Adding scripts to package.json only**: Already done; bash scripts provide direct CLI access
