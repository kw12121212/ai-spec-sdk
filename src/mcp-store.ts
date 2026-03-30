import { ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { defaultLogger as logger } from "./logger.js";

export interface McpServerConfig {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface McpServerEntry {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  status: "running" | "stopped" | "error";
  pid: number | null;
  error: string | null;
}

export class McpStore {
  private servers: Map<string, Map<string, McpServerEntry>>;
  private processes: Map<string, ChildProcess>;
  private onNotification: (method: string, params: Record<string, unknown>) => void;

  constructor(
    onNotification: (method: string, params: Record<string, unknown>) => void = () => {},
  ) {
    this.servers = new Map();
    this.processes = new Map();
    this.onNotification = onNotification;
    this._loadAllFromDisk();
  }

  private _key(workspace: string, name: string): string {
    return `${workspace}::${name}`;
  }

  private _mcpDir(workspace: string): string {
    return path.join(workspace, ".claude", "mcp");
  }

  private _configPath(workspace: string, name: string): string {
    return path.join(this._mcpDir(workspace), `${name}.json`);
  }

  private _loadAllFromDisk(): void {
    // Scan known workspaces from workspace-store is not available here,
    // so we load lazily when list/add is called per workspace.
  }

  private _loadWorkspaceFromDisk(workspace: string): void {
    if (this.servers.has(workspace)) return;

    const dir = this._mcpDir(workspace);
    const entries = new Map<string, McpServerEntry>();

    try {
      for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith(".json")) continue;
        try {
          const raw = fs.readFileSync(path.join(dir, file), "utf8");
          const config = JSON.parse(raw) as McpServerConfig;
          if (config && typeof config.name === "string" && typeof config.command === "string") {
            entries.set(config.name, {
              name: config.name,
              command: config.command,
              args: Array.isArray(config.args) ? config.args : [],
              env: config.env && typeof config.env === "object" && !Array.isArray(config.env)
                ? config.env as Record<string, string>
                : {},
              status: "stopped",
              pid: null,
              error: null,
            });
          }
        } catch {
          // skip corrupt files
        }
      }
    } catch {
      // directory doesn't exist yet
    }

    this.servers.set(workspace, entries);
  }

  private _persistConfig(workspace: string, config: McpServerConfig): void {
    const dir = this._mcpDir(workspace);
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = this._configPath(workspace, config.name) + ".tmp";
    const finalPath = this._configPath(workspace, config.name);
    fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), "utf8");
    fs.renameSync(tmpPath, finalPath);
  }

  private _deleteConfig(workspace: string, name: string): void {
    try {
      fs.unlinkSync(this._configPath(workspace, name));
    } catch {
      // already gone
    }
  }

  add(workspace: string, config: McpServerConfig): McpServerEntry {
    this._loadWorkspaceFromDisk(workspace);

    const workspaceMap = this.servers.get(workspace)!;
    if (workspaceMap.has(config.name)) {
      throw new Error(`MCP server '${config.name}' already exists for workspace`);
    }

    this._persistConfig(workspace, config);

    const entry: McpServerEntry = {
      name: config.name,
      command: config.command,
      args: config.args,
      env: config.env,
      status: "running",
      pid: null,
      error: null,
    };

    workspaceMap.set(config.name, entry);
    this._startProcess(workspace, config.name);

    return entry;
  }

  remove(workspace: string, name: string): void {
    this._loadWorkspaceFromDisk(workspace);

    const workspaceMap = this.servers.get(workspace);
    if (!workspaceMap || !workspaceMap.has(name)) {
      throw new Error(`MCP server '${name}' not found for workspace`);
    }

    this._stopProcess(workspace, name);
    this._deleteConfig(workspace, name);
    workspaceMap.delete(name);
  }

  start(workspace: string, name: string): McpServerEntry {
    this._loadWorkspaceFromDisk(workspace);

    const workspaceMap = this.servers.get(workspace);
    if (!workspaceMap || !workspaceMap.has(name)) {
      throw new Error(`MCP server '${name}' not found for workspace`);
    }

    const entry = workspaceMap.get(name)!;
    if (entry.status === "running") {
      return entry;
    }

    entry.status = "running";
    entry.error = null;
    this._startProcess(workspace, name);

    return entry;
  }

  stop(workspace: string, name: string): McpServerEntry {
    this._loadWorkspaceFromDisk(workspace);

    const workspaceMap = this.servers.get(workspace);
    if (!workspaceMap || !workspaceMap.has(name)) {
      throw new Error(`MCP server '${name}' not found for workspace`);
    }

    const entry = workspaceMap.get(name)!;
    if (entry.status === "stopped") {
      return entry;
    }

    this._stopProcess(workspace, name);
    entry.status = "stopped";
    entry.pid = null;

    return entry;
  }

  list(workspace: string): McpServerEntry[] {
    this._loadWorkspaceFromDisk(workspace);
    const workspaceMap = this.servers.get(workspace);
    if (!workspaceMap) return [];
    return Array.from(workspaceMap.values());
  }

  private _startProcess(workspace: string, name: string): void {
    const workspaceMap = this.servers.get(workspace);
    if (!workspaceMap) return;
    const entry = workspaceMap.get(name);
    if (!entry) return;

    try {
      const child = spawn(entry.command, entry.args, {
        cwd: workspace,
        env: { ...process.env, ...entry.env },
        stdio: ["pipe", "pipe", "pipe"],
      });

      entry.pid = child.pid ?? null;
      logger.info("mcp server started", { workspace, name, pid: entry.pid });

      child.on("error", (err) => {
        entry.status = "error";
        entry.error = err.message;
        entry.pid = null;
        this.processes.delete(this._key(workspace, name));
        logger.error("mcp server error", { workspace, name, error: err.message });
        this.onNotification("mcp/server_error", {
          workspace,
          name,
          error: err.message,
        });
      });

      child.on("exit", (code) => {
        if (entry.status === "running") {
          entry.status = "stopped";
        }
        entry.pid = null;
        this.processes.delete(this._key(workspace, name));
        logger.info("mcp server exited", { workspace, name, exitCode: code ?? 0 });
        this.onNotification("mcp/server_stopped", {
          workspace,
          name,
          exitCode: code ?? 0,
        });
      });

      this.processes.set(this._key(workspace, name), child);
      this.onNotification("mcp/server_started", {
        workspace,
        name,
        pid: entry.pid,
      });
    } catch (err) {
      entry.status = "error";
      entry.error = (err as Error).message;
      this.onNotification("mcp/server_error", {
        workspace,
        name,
        error: (err as Error).message,
      });
    }
  }

  private _stopProcess(workspace: string, name: string): void {
    const key = this._key(workspace, name);
    const child = this.processes.get(key);
    if (child && !child.killed) {
      child.kill();
    }
    this.processes.delete(key);
  }

  shutdown(): void {
    for (const [key, child] of this.processes) {
      if (!child.killed) {
        child.kill();
      }
      this.processes.delete(key);
    }
  }
}
