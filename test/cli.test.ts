import { test, expect } from "bun:test";
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
  expect(exitCode).toBe(0);
});

test("--help output contains version", () => {
  const { stdout } = runCli(["--help"]);
  expect(stdout.includes(BRIDGE_VERSION), `--help should mention version ${BRIDGE_VERSION}`).toBeTruthy();
});

test("--help output documents doctor subcommand", () => {
  const { stdout } = runCli(["--help"]);
  expect(stdout.includes("doctor"), "--help should mention doctor subcommand").toBeTruthy();
});

test("--help output documents keygen subcommand", () => {
  const { stdout } = runCli(["--help"]);
  expect(stdout.includes("keygen"), "--help should mention keygen subcommand").toBeTruthy();
});

test("-h is an alias for --help", () => {
  const { exitCode, stdout } = runCli(["-h"]);
  expect(exitCode).toBe(0);
  expect(stdout.includes(BRIDGE_VERSION)).toBeTruthy();
});

// ── doctor tests ──────────────────────────────────────────────────────────────

test("doctor exits with code 0 or 1 (healthy or warnings)", () => {
  const { exitCode } = runCli(["doctor"]);
  expect(exitCode === 0 || exitCode === 1, `doctor should exit 0 or 1, got ${exitCode}`).toBeTruthy();
});

test("doctor outputs human-readable text by default", () => {
  const { stdout } = runCli(["doctor"]);
  expect(stdout.includes("Bridge version:"), "doctor should show bridge version label").toBeTruthy();
  expect(stdout.includes("Transport:"), "doctor should show transport label").toBeTruthy();
  expect(stdout.includes("Checks:"), "doctor should show checks section").toBeTruthy();
});

test("doctor --json exits with code 0 or 1", () => {
  const { exitCode } = runCli(["doctor", "--json"]);
  expect(exitCode === 0 || exitCode === 1, `doctor --json should exit 0 or 1, got ${exitCode}`).toBeTruthy();
});

test("doctor --json outputs valid JSON", () => {
  const { stdout } = runCli(["doctor", "--json"]);
  let parsed: unknown;
  expect(() => {
    parsed = JSON.parse(stdout) as unknown;
  }, `doctor --json should output valid JSON, got: ${stdout.slice(0, 200)}`).not.toThrow();
  expect(parsed !== null && typeof parsed === "object").toBeTruthy();
});

test("doctor --json output has info and checks fields", () => {
  const { stdout } = runCli(["doctor", "--json"]);
  const parsed = JSON.parse(stdout) as Record<string, unknown>;
  expect("info" in parsed, "doctor --json should have 'info' field").toBeTruthy();
  expect("checks" in parsed, "doctor --json should have 'checks' field").toBeTruthy();
  expect(Array.isArray(parsed["checks"]), "'checks' should be an array").toBeTruthy();
});

test("doctor --json info field matches runtime-info shape", () => {
  const { stdout } = runCli(["doctor", "--json"]);
  const parsed = JSON.parse(stdout) as Record<string, unknown>;
  const info = parsed["info"] as Record<string, unknown>;
  expect(typeof info["bridgeVersion"]).toBe("string");
  expect(typeof info["apiVersion"]).toBe("string");
  expect(typeof info["transport"]).toBe("string");
  expect(typeof info["authMode"]).toBe("string");
  expect(typeof info["logLevel"]).toBe("string");
  expect(typeof info["sessionsPath"]).toBe("string");
  expect(typeof info["keysPath"]).toBe("string");
  expect(typeof info["specDrivenScriptPath"]).toBe("string");
  expect(typeof info["nodeVersion"]).toBe("string");
});

test("doctor --json bridgeVersion matches BRIDGE_VERSION", () => {
  const { stdout } = runCli(["doctor", "--json"]);
  const parsed = JSON.parse(stdout) as Record<string, unknown>;
  const info = parsed["info"] as Record<string, unknown>;
  expect(info["bridgeVersion"]).toBe(BRIDGE_VERSION);
  expect(info["apiVersion"]).toBe(API_VERSION);
});

// ── version alignment regression ──────────────────────────────────────────────

test("package.json version matches BRIDGE_VERSION", () => {
  const pkgPath = resolve(PROJECT_ROOT, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
  expect(pkg.version).toBe(BRIDGE_VERSION,
    `package.json version (${pkg.version}) must match BRIDGE_VERSION (${BRIDGE_VERSION})`);
});

test("package.json version matches API_VERSION", () => {
  const pkgPath = resolve(PROJECT_ROOT, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
  expect(pkg.version).toBe(API_VERSION,
    `package.json version (${pkg.version}) must match API_VERSION (${API_VERSION})`);
});
