import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { BridgeError } from "./errors.js";
import { SUPPORTED_WORKFLOWS } from "./capabilities.js";

const execFileAsync = promisify(execFile);

function resolveSpecDrivenScript() {
  if (process.env.SPEC_DRIVEN_SCRIPT) {
    return process.env.SPEC_DRIVEN_SCRIPT;
  }

  const home = os.homedir();
  const candidates = [
    path.join(process.cwd(), ".config", "opencode", "skills", "spec-driven-apply", "scripts", "spec-driven.js"),
    path.join(process.cwd(), ".agents", "skills", "spec-driven-apply", "scripts", "spec-driven.js"),
    path.join(home, ".slim-spec-driven", "skills", "spec-driven-apply", "scripts", "spec-driven.js"),
    path.join(home, ".config", "opencode", "skills", "spec-driven-apply", "scripts", "spec-driven.js"),
    path.join(home, ".agents", "skills", "spec-driven-apply", "scripts", "spec-driven.js"),
    "/home/code/.config/opencode/skills/spec-driven-apply/scripts/spec-driven.js",
    "/home/code/.agents/skills/spec-driven-apply/scripts/spec-driven.js",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function ensureWorkspace(workspace) {
  if (!workspace || typeof workspace !== "string") {
    throw new BridgeError(-32602, "'workspace' must be a string path");
  }

  const resolved = path.resolve(workspace);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new BridgeError(-32001, "Workspace path does not exist", { workspace: resolved });
  }

  return resolved;
}

function ensureWorkflow(workflow) {
  if (!workflow || typeof workflow !== "string") {
    throw new BridgeError(-32602, "'workflow' must be a string");
  }

  if (!SUPPORTED_WORKFLOWS.includes(workflow)) {
    throw new BridgeError(-32602, "Unsupported workflow", {
      workflow,
      supported: SUPPORTED_WORKFLOWS,
    });
  }
}

export async function runWorkflow(params, emitNotification = () => {}) {
  const { workspace, workflow, args = [] } = params || {};

  const resolvedWorkspace = ensureWorkspace(workspace);
  ensureWorkflow(workflow);

  if (!Array.isArray(args)) {
    throw new BridgeError(-32602, "'args' must be an array of strings");
  }

  const scriptPath = resolveSpecDrivenScript();
  if (!fs.existsSync(scriptPath)) {
    throw new BridgeError(-32002, "spec-driven script not found", { scriptPath });
  }

  emitNotification("bridge/progress", {
    phase: "workflow_started",
    workflow,
    workspace: resolvedWorkspace,
  });

  try {
    const invocationArgs = [scriptPath, workflow, ...args.map((value) => String(value))];
    const { stdout, stderr } = await execFileAsync("node", invocationArgs, {
      cwd: resolvedWorkspace,
    });

    emitNotification("bridge/progress", {
      phase: "workflow_completed",
      workflow,
      workspace: resolvedWorkspace,
    });

    return {
      workflow,
      workspace: resolvedWorkspace,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      parsed: safelyParseJson(stdout),
    };
  } catch (error) {
    emitNotification("bridge/progress", {
      phase: "workflow_failed",
      workflow,
      workspace: resolvedWorkspace,
    });

    throw new BridgeError(-32003, "Workflow execution failed", {
      workflow,
      workspace: resolvedWorkspace,
      message: error.message,
      stdout: error.stdout ? String(error.stdout).trim() : "",
      stderr: error.stderr ? String(error.stderr).trim() : "",
      code: error.code,
    });
  }
}

function safelyParseJson(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
