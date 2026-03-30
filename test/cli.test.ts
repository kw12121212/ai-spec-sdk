import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { BRIDGE_VERSION, API_VERSION } from "../src/capabilities.js";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const CLI = resolve(PROJECT_ROOT, "src/cli.ts");

/** Run the CLI with given args, returns { stdout, stderr, exitCode }. */
function runCli(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync("bun", ["run", CLI, ...args], {
      cwd: PROJECT_ROOT,
      timeout: 10_000,
    }).toString();
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer; stderr?: Buffer; status?: number };
    return {
      stdout: e.stdout?.toString() ?? "",
      stderr: e.stderr?.toString() ?? "",
      exitCode: e.status ?? 1,
    };
  }
}

// ── --help tests ──────────────────────────────────────────────────────────────

test("--help exits with code 0", () => {
  const { exitCode } = runCli(["--help"]);
  assert.equal(exitCode, 0);
});

test("--help output contains version", () => {
  const { stdout } = runCli(["--help"]);
  assert.ok(stdout.includes(BRIDGE_VERSION), `--help should mention version ${BRIDGE_VERSION}`);
});

test("--help output documents doctor subcommand", () => {
  const { stdout } = runCli(["--help"]);
  assert.ok(stdout.includes("doctor"), "--help should mention doctor subcommand");
});

test("--help output documents keygen subcommand", () => {
  const { stdout } = runCli(["--help"]);
  assert.ok(stdout.includes("keygen"), "--help should mention keygen subcommand");
});

test("-h is an alias for --help", () => {
  const { exitCode, stdout } = runCli(["-h"]);
  assert.equal(exitCode, 0);
  assert.ok(stdout.includes(BRIDGE_VERSION));
});

// ── doctor tests ──────────────────────────────────────────────────────────────

test("doctor exits with code 0 or 1 (healthy or warnings)", () => {
  const { exitCode } = runCli(["doctor"]);
  assert.ok(exitCode === 0 || exitCode === 1, `doctor should exit 0 or 1, got ${exitCode}`);
});

test("doctor outputs human-readable text by default", () => {
  const { stdout } = runCli(["doctor"]);
  assert.ok(stdout.includes("Bridge version:"), "doctor should show bridge version label");
  assert.ok(stdout.includes("Transport:"), "doctor should show transport label");
  assert.ok(stdout.includes("Checks:"), "doctor should show checks section");
});

test("doctor --json exits with code 0 or 1", () => {
  const { exitCode } = runCli(["doctor", "--json"]);
  assert.ok(exitCode === 0 || exitCode === 1, `doctor --json should exit 0 or 1, got ${exitCode}`);
});

test("doctor --json outputs valid JSON", () => {
  const { stdout } = runCli(["doctor", "--json"]);
  let parsed: unknown;
  assert.doesNotThrow(() => {
    parsed = JSON.parse(stdout) as unknown;
  }, `doctor --json should output valid JSON, got: ${stdout.slice(0, 200)}`);
  assert.ok(parsed !== null && typeof parsed === "object");
});

test("doctor --json output has info and checks fields", () => {
  const { stdout } = runCli(["doctor", "--json"]);
  const parsed = JSON.parse(stdout) as Record<string, unknown>;
  assert.ok("info" in parsed, "doctor --json should have 'info' field");
  assert.ok("checks" in parsed, "doctor --json should have 'checks' field");
  assert.ok(Array.isArray(parsed["checks"]), "'checks' should be an array");
});

test("doctor --json info field matches runtime-info shape", () => {
  const { stdout } = runCli(["doctor", "--json"]);
  const parsed = JSON.parse(stdout) as Record<string, unknown>;
  const info = parsed["info"] as Record<string, unknown>;
  assert.equal(typeof info["bridgeVersion"], "string");
  assert.equal(typeof info["apiVersion"], "string");
  assert.equal(typeof info["transport"], "string");
  assert.equal(typeof info["authMode"], "string");
  assert.equal(typeof info["logLevel"], "string");
  assert.equal(typeof info["sessionsPath"], "string");
  assert.equal(typeof info["keysPath"], "string");
  assert.equal(typeof info["specDrivenScriptPath"], "string");
  assert.equal(typeof info["nodeVersion"], "string");
});

test("doctor --json bridgeVersion matches BRIDGE_VERSION", () => {
  const { stdout } = runCli(["doctor", "--json"]);
  const parsed = JSON.parse(stdout) as Record<string, unknown>;
  const info = parsed["info"] as Record<string, unknown>;
  assert.equal(info["bridgeVersion"], BRIDGE_VERSION);
  assert.equal(info["apiVersion"], API_VERSION);
});

// ── version alignment regression ──────────────────────────────────────────────

test("package.json version matches BRIDGE_VERSION", () => {
  const pkgPath = resolve(PROJECT_ROOT, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
  assert.equal(pkg.version, BRIDGE_VERSION,
    `package.json version (${pkg.version}) must match BRIDGE_VERSION (${BRIDGE_VERSION})`);
});

test("package.json version matches API_VERSION", () => {
  const pkgPath = resolve(PROJECT_ROOT, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
  assert.equal(pkg.version, API_VERSION,
    `package.json version (${pkg.version}) must match API_VERSION (${API_VERSION})`);
});
