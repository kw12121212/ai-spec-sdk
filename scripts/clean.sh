set -euo pipefail
cd "$(dirname "$0")/.."

echo "clean: removing dist/"
rm -rf dist/
echo "clean: done"
