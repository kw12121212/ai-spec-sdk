set -euo pipefail
cd "$(dirname "$0")/.."

echo "check: lint"
bun run lint

echo "check: typecheck"
bun run typecheck

echo "check: test"
bun test

echo "check: all passed"
