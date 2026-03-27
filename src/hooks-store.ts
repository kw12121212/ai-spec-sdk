import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type HookEvent = "pre_tool_use" | "post_tool_use" | "notification" | "stop" | "subagent_stop";

const VALID_EVENTS = new Set<string>([
  "pre_tool_use",
  "post_tool_use",
  "notification",
  "stop",
  "subagent_stop",
]);

export interface HookEntry {
  hookId: string;
  event: HookEvent;
  command: string;
  matcher?: string;
  scope: "project" | "user";
  workspace?: string;
}

function userHooksPath(): string {
  return path.join(os.homedir(), ".claude", "hooks.json");
}

function projectHooksPath(workspace: string): string {
  return path.join(workspace, ".claude", "hooks.json");
}

function readHooksFile(filePath: string): HookEntry[] {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as HookEntry[];
    return [];
  } catch {
    return [];
  }
}

function writeHooksFile(filePath: string, hooks: HookEntry[]): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = filePath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(hooks, null, 2), "utf8");
  fs.renameSync(tmpPath, filePath);
}

export class HooksStore {
  add(params: {
    event: string;
    command: string;
    matcher?: string;
    scope: "project" | "user";
    workspace?: string;
  }): HookEntry {
    if (!VALID_EVENTS.has(params.event)) {
      throw new Error(
        `Invalid hook event '${params.event}'. Must be one of: ${[...VALID_EVENTS].join(", ")}`,
      );
    }

    if (typeof params.command !== "string" || params.command.length === 0) {
      throw new Error("'command' must be a non-empty string");
    }

    if (params.scope === "project" && !params.workspace) {
      throw new Error("'workspace' is required for project-scoped hooks");
    }

    const hook: HookEntry = {
      hookId: crypto.randomUUID(),
      event: params.event as HookEvent,
      command: params.command,
      ...(params.matcher && { matcher: params.matcher }),
      scope: params.scope,
      ...(params.workspace && { workspace: params.workspace }),
    };

    const filePath = params.scope === "project" && params.workspace
      ? projectHooksPath(params.workspace)
      : userHooksPath();

    const hooks = readHooksFile(filePath);
    hooks.push(hook);
    writeHooksFile(filePath, hooks);

    return hook;
  }

  remove(hookId: string): void {
    // Try user hooks first, then project hooks for all known workspaces
    const userPath = userHooksPath();
    let hooks = readHooksFile(userPath);
    const userIndex = hooks.findIndex((h) => h.hookId === hookId);
    if (userIndex !== -1) {
      hooks.splice(userIndex, 1);
      writeHooksFile(userPath, hooks);
      return;
    }

    throw new Error(`Hook '${hookId}' not found`);
  }

  list(workspace?: string): HookEntry[] {
    const userHooks = readHooksFile(userHooksPath());
    const projectHooks = workspace ? readHooksFile(projectHooksPath(workspace)) : [];

    return [...projectHooks, ...userHooks];
  }

  findMatching(event: HookEvent, toolName?: string, workspace?: string): HookEntry[] {
    const all = this.list(workspace);
    return all.filter((hook) => {
      if (hook.event !== event) return false;
      if (hook.matcher) {
        if (!toolName) return false;
        // Simple glob-like matching: exact match or wildcard
        if (hook.matcher === "*") return true;
        return toolName === hook.matcher;
      }
      return true;
    });
  }

  isBlocking(event: HookEvent): boolean {
    return event === "pre_tool_use";
  }
}
