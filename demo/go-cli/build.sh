#!/usr/bin/env bash
set -euo pipefail

# Build script for ai-cli
# Usage: ./build.sh [output_name]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

OUTPUT="${1:-ai-cli}"
LDFLAGS="-s -w"
GCFLAGS="all=-trimpath=${OUTPUT}"

echo "Building ${OUTPUT}..."
CGO_ENABLED=0 go build -ldflags "${LDFLAGS}" -gcflags "${GCFLAGS}" -o "${OUTPUT}" .
echo "Built: $(ls -lh "${OUTPUT}" | awk '{print $5, $9}')"
