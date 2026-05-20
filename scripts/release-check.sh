#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

root_version="$(node -p "require('./package.json').version")"
client_version="$(node -p "require('./packages/client/package.json').version")"
source_bridge_version="$(node -e "const fs=require('fs'); const source=fs.readFileSync('src/capabilities.ts','utf8'); const match=source.match(/export const BRIDGE_VERSION = \"([^\"]+)\";/); if (!match) process.exit(1); console.log(match[1])")"
contract_bridge_version="$(node -e "const fs=require('fs'); const yaml=require('js-yaml'); const doc=yaml.load(fs.readFileSync('docs/bridge-contract.yaml','utf8')); console.log(doc.contract.bridgeVersion)")"
contract_api_version="$(node -e "const fs=require('fs'); const yaml=require('js-yaml'); const doc=yaml.load(fs.readFileSync('docs/bridge-contract.yaml','utf8')); console.log(doc.contract.apiVersion)")"

if [[ "$root_version" != "$client_version" ]]; then
  echo "release-check: version drift: package.json=$root_version packages/client/package.json=$client_version" >&2
  exit 1
fi

if [[ "$root_version" != "$source_bridge_version" ]]; then
  echo "release-check: version drift: package.json=$root_version src/capabilities.ts=$source_bridge_version" >&2
  exit 1
fi

if [[ "$root_version" != "$contract_bridge_version" ]]; then
  echo "release-check: version drift: package.json=$root_version docs/bridge-contract.yaml bridgeVersion=$contract_bridge_version" >&2
  exit 1
fi

if [[ "$root_version" != "$contract_api_version" ]]; then
  echo "release-check: version drift: package.json=$root_version docs/bridge-contract.yaml apiVersion=$contract_api_version" >&2
  exit 1
fi

echo "release-check: lint"
bun run lint

echo "release-check: tests"
bun run test

echo "release-check: build"
bun run build

echo "release-check: TypeScript client build"
(cd packages/client && bun run build)

echo "release-check: native build smoke"
NATIVE_BUILD_TEST=1 bun test test/native-build.test.ts

echo "release-check: all passed"
