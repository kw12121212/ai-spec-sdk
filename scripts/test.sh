set -euo pipefail
cd "$(dirname "$0")/.."

bun test "$@"
