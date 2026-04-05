#!/usr/bin/env bash
set -euo pipefail

TARGETS=(
  "bun-linux-x64:dist/ai-spec-bridge-linux-x64"
  "bun-linux-arm64:dist/ai-spec-bridge-linux-arm64"
  "bun-darwin-x64:dist/ai-spec-bridge-macos-x64"
  "bun-darwin-arm64:dist/ai-spec-bridge-macos-arm64"
  "bun-windows-x64:dist/ai-spec-bridge-windows-x64.exe"
)

if command -v sha256sum > /dev/null 2>&1; then
  SHASUM_CMD="sha256sum"
else
  SHASUM_CMD="shasum -a 256"
fi

mkdir -p dist

for entry in "${TARGETS[@]}"; do
  target="${entry%%:*}"
  outfile="${entry##*:}"
  echo "Building $outfile ($target)..."
  bun build --compile --target="$target" src/cli.ts --outfile "$outfile"
  $SHASUM_CMD "$outfile" > "${outfile}.sha256"
  echo "  Checksum: ${outfile}.sha256"
done

echo "Done. All binaries in dist/:"
ls dist/ai-spec-bridge-* 2>/dev/null || true
