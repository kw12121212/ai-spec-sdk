import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { BRIDGE_VERSION, API_VERSION } from "./capabilities.js";
import { defaultLogger } from "./logger.js";

/** Core runtime information shared between bridge.info and doctor. */
export interface RuntimeInfo {
  bridgeVersion: string;
  apiVersion: string;
  transport: string;
  authMode: string;
  logLevel: string;
  sessionsPath: string;
  keysPath: string;
  specDrivenScriptPath: string;
  http: HttpRuntimeInfo | null;
  nodeVersion: string;
}

export interface HttpRuntimeInfo {
  port: number;
  corsOrigins: string;
}

/** Diagnostic check result. */
export interface DiagCheck {
  name: string;
  ok: boolean;
  detail: string;
}

/** Full doctor output — superset of RuntimeInfo. */
export interface DoctorInfo {
  info: RuntimeInfo;
  checks: DiagCheck[];
}

/** Candidate paths for the spec-driven.js script (mirrors workflow.ts logic). */
function resolveSpecDrivenScriptPath(): string {
  if (process.env["SPEC_DRIVEN_SCRIPT"]) {
    return process.env["SPEC_DRIVEN_SCRIPT"];
  }

  const home = os.homedir();
  const candidates = [
    path.join(process.cwd(), ".config", "opencode", "skills", "spec-driven-apply", "scripts", "spec-driven.js"),
    path.join(process.cwd(), ".agents", "skills", "spec-driven-apply", "scripts", "spec-driven.js"),
    path.join(home, ".slim-spec-driven", "skills", "spec-driven-apply", "scripts", "spec-driven.js"),
    path.join(home, ".config", "opencode", "skills", "spec-driven-apply", "scripts", "spec-driven.js"),
    path.join(home, ".agents", "skills", "spec-driven-apply", "scripts", "spec-driven.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0]!;
}

export interface RuntimeInfoOptions {
  transport?: string;
  authMode?: string;
  sessionsDir?: string;
  keysFile?: string;
  httpPort?: number;
}

/**
 * Build a RuntimeInfo snapshot from the current process environment and
 * the options provided by the running transport.  All fields are read-only
 * metadata — nothing is mutated.
 */
export function buildRuntimeInfo(opts: RuntimeInfoOptions = {}): RuntimeInfo {
  const {
    transport = process.env["AI_SPEC_SDK_TRANSPORT"] ?? "stdio",
    authMode = process.env["AI_SPEC_BRIDGE_NO_AUTH"] === "1" ? "none" : (transport === "http" ? "bearer" : "none"),
    sessionsDir = path.join(os.homedir(), ".ai-spec-sdk", "sessions"),
    keysFile = path.join(os.homedir(), ".ai-spec-sdk", "keys.json"),
    httpPort,
  } = opts;

  const isHttp = transport === "http";
  const httpInfo: HttpRuntimeInfo | null = isHttp
    ? {
        port: httpPort ?? parseInt(process.env["AI_SPEC_SDK_PORT"] ?? "8765", 10),
        corsOrigins: process.env["AI_SPEC_SDK_CORS_ORIGINS"] ?? "*",
      }
    : null;

  return {
    bridgeVersion: resolvePackageVersion(),
    apiVersion: API_VERSION,
    transport,
    authMode,
    logLevel: defaultLogger.getLevel(),
    sessionsPath: path.resolve(sessionsDir),
    keysPath: path.resolve(keysFile),
    specDrivenScriptPath: resolveSpecDrivenScriptPath(),
    http: httpInfo,
    nodeVersion: process.version,
  };
}

/**
 * Run diagnostic checks against a RuntimeInfo snapshot and return the
 * extended DoctorInfo that includes per-check pass/fail results.
 */
export function buildDoctorInfo(opts: RuntimeInfoOptions = {}): DoctorInfo {
  const info = buildRuntimeInfo(opts);
  const checks: DiagCheck[] = [];

  // Check: sessions directory exists
  const sessionsExists = fs.existsSync(info.sessionsPath);
  checks.push({
    name: "sessions_dir",
    ok: sessionsExists,
    detail: sessionsExists
      ? `${info.sessionsPath} exists`
      : `${info.sessionsPath} does not exist (will be created on first session)`,
  });

  // Check: keys file exists (only meaningful when auth is enabled)
  if (info.authMode !== "none") {
    const keysExists = fs.existsSync(info.keysPath);
    checks.push({
      name: "keys_file",
      ok: keysExists,
      detail: keysExists
        ? `${info.keysPath} exists`
        : `${info.keysPath} not found — run 'ai-spec-bridge keygen' to create an API key`,
    });
  }

  // Check: spec-driven script resolvable
  const scriptExists = fs.existsSync(info.specDrivenScriptPath);
  checks.push({
    name: "spec_driven_script",
    ok: scriptExists,
    detail: scriptExists
      ? `${info.specDrivenScriptPath} found`
      : `${info.specDrivenScriptPath} not found — workflow.run will fail`,
  });

  return { info, checks };
}

/**
 * Resolve the package version from package.json.
 * Falls back to BRIDGE_VERSION if package.json cannot be found or parsed.
 */
export function resolvePackageVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("../package.json") as { version?: string };
    if (typeof pkg.version === "string") return pkg.version;
  } catch {
    // ignore — fall through
  }
  return BRIDGE_VERSION;
}
