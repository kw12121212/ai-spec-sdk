import test from "node:test";
import assert from "node:assert/strict";
import { execSync, spawn } from "node:child_process";
import { existsSync, accessSync, constants } from "node:fs";
import { resolve } from "node:path";

const ENABLED = process.env["NATIVE_BUILD_TEST"] === "1";
const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const BINARY = resolve(PROJECT_ROOT, "dist/ai-spec-bridge-native");

test("build:native produces an executable binary at dist/ai-spec-bridge-native", () => {
  if (!ENABLED) return;
  execSync("bun run build:native", { cwd: PROJECT_ROOT, stdio: "inherit" });
  assert.ok(existsSync(BINARY), `binary not found at ${BINARY}`);
  accessSync(BINARY, constants.X_OK);
});

test("native binary responds to bridge.capabilities with valid JSON-RPC result", async () => {
  if (!ENABLED) return;
  const response = await new Promise<string>((resolve, reject) => {
    const proc = spawn(BINARY, [], { stdio: ["pipe", "pipe", "inherit"] });
    let output = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      if (output.includes("\n")) {
        proc.kill();
        resolve(output.trim());
      }
    });

    proc.on("error", reject);

    proc.stdin.write(
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "bridge.capabilities" }) + "\n",
    );
  });

  const parsed = JSON.parse(response) as Record<string, unknown>;
  assert.equal(parsed["jsonrpc"], "2.0");
  assert.equal(parsed["id"], 1);
  assert.ok(parsed["result"] !== undefined, "expected result field");
  assert.equal(
    (parsed["result"] as Record<string, unknown>)["transport"],
    "stdio",
  );
});
