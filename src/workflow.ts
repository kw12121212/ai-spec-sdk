import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { BridgeError } from "./errors.js";
import { SUPPORTED_WORKFLOWS } from "./capabilities.js";

const execFileAsync = promisify(execFile);

/** Map bridge workflow names to spec-driven.js script subcommands. */
const WORKFLOW_SCRIPT_MAP: Readonly<Record<string, string>> = {
  maintenance: "run-maintenance",
};

function resolveSpecDrivenScript(): string {
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
    "/home/code/.config/opencode/skills/spec-driven-apply/scripts/spec-driven.js",
    "/home/code/.agents/skills/spec-driven-apply/scripts/spec-driven.js",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0]!;
}

function ensureWorkspace(workspace: unknown): string {
  if (!workspace || typeof workspace !== "string") {
    throw new BridgeError(-32602, "'workspace' must be a string path");
  }

  const resolved = path.resolve(workspace);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new BridgeError(-32001, "Workspace path does not exist", { workspace: resolved });
  }

  return resolved;
}

function ensureWorkflow(workflow: unknown): void {
  if (!workflow || typeof workflow !== "string") {
    throw new BridgeError(-32602, "'workflow' must be a string");
  }

  if (!(SUPPORTED_WORKFLOWS as readonly string[]).includes(workflow)) {
    throw new BridgeError(-32602, "Unsupported workflow", {
      workflow,
      supported: SUPPORTED_WORKFLOWS,
    });
  }
}

export interface WorkflowParams {
  workspace: unknown;
  workflow: unknown;
  args?: unknown[];
}

export interface WorkflowResult {
  workflow: string;
  workspace: string;
  stdout: string;
  stderr: string;
  parsed: unknown;
}

type NotifyFn = (event: string, payload: Record<string, unknown>) => void;

export async function runWorkflow(
  params: WorkflowParams | null | undefined,
  emitNotification: NotifyFn = () => {},
): Promise<WorkflowResult> {
  const { workspace, workflow, args = [] } = params ?? {};

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
    workflow: workflow as string,
    workspace: resolvedWorkspace,
  });

  try {
    const scriptSubcommand = WORKFLOW_SCRIPT_MAP[workflow as string] ?? (workflow as string);
    const invocationArgs = [scriptPath, scriptSubcommand, ...args.map((value) => String(value))];
    const { stdout, stderr } = await execFileAsync("node", invocationArgs, {
      cwd: resolvedWorkspace,
    });

    emitNotification("bridge/progress", {
      phase: "workflow_completed",
      workflow: workflow as string,
      workspace: resolvedWorkspace,
    });

    return {
      workflow: workflow as string,
      workspace: resolvedWorkspace,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      parsed: safelyParseJson(stdout),
    };
  } catch (error) {
    emitNotification("bridge/progress", {
      phase: "workflow_failed",
      workflow: workflow as string,
      workspace: resolvedWorkspace,
    });

    const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    throw new BridgeError(-32003, "Workflow execution failed", {
      workflow,
      workspace: resolvedWorkspace,
      message: err.message,
      stdout: err.stdout ? String(err.stdout).trim() : "",
      stderr: err.stderr ? String(err.stderr).trim() : "",
      code: err.code,
    });
  }
}

function safelyParseJson(value: unknown): unknown {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
