#!/usr/bin/env node
/**
 * Type Generator Entry Point
 * 
 * Generates TypeScript and Python type definitions from bridge-contract.yaml
 */

import * as path from "path";
import { fileURLToPath } from "url";
import { parseContract } from "./lib/contract-parser.js";
import { generateTypeScriptTypes } from "./lib/ts-generator.js";
import { generatePythonTypes } from "./lib/py-generator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTRACT_PATH = path.resolve(__dirname, "../docs/bridge-contract.yaml");
const TS_OUTPUT_PATH = path.resolve(__dirname, "../packages/client/src/types.ts");
const PY_OUTPUT_PATH = path.resolve(__dirname, "../clients/python/src/ai_spec_sdk/types.py");

function main(): void {
  console.log("🔍 Parsing bridge-contract.yaml...");
  const contract = parseContract(CONTRACT_PATH);

  console.log(`📊 Found ${contract.methods.length} methods`);
  console.log(`📊 Found ${contract.notifications.length} notification types`);
  console.log(`📊 Found ${contract.errorCodes.length} error codes`);

  console.log("\n📝 Generating TypeScript types...");
  generateTypeScriptTypes(contract, TS_OUTPUT_PATH);
  console.log(`✅ TypeScript types written to: ${TS_OUTPUT_PATH}`);

  console.log("\n🐍 Generating Python types...");
  generatePythonTypes(contract, PY_OUTPUT_PATH);
  console.log(`✅ Python types written to: ${PY_OUTPUT_PATH}`);

  console.log("\n🎉 Type generation complete!");
}

main();
