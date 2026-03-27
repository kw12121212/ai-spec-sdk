set -euo pipefail
cd "$(dirname "$0")/.."

echo "build: cleaning dist/"
rm -rf dist/

echo "build: compiling"
bun run build

echo "build: done"
