import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import type { Transport } from "./transport.js";
import type { JsonRpcNotification } from "./types.js";
import { BridgeClientError } from "./errors.js";

export interface StdioTransportOptions {
  /** Path to the bridge binary. Defaults to "ai-spec-bridge". */
  command?: string;
  /** Arguments forwarded to the bridge process. */
  args?: string[];
  /** Environment variables for the bridge process. */
  env?: Record<string, string>;
  /** Current working directory for the bridge process. */
  cwd?: string;
}

export class StdioTransport implements Transport {
  private process: ChildProcess | null = null;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (err: Error) => void }
  >();
  private notificationHandlers: Array<(n: JsonRpcNotification) => void> = [];
  private _isClosed = false;

  constructor(private readonly options: StdioTransportOptions = {}) {}

  get isClosed(): boolean {
    return this._isClosed;
  }

  private ensureProcess(): ChildProcess {
    if (this.process && !this.process.killed) return this.process;

    const cmd = this.options.command ?? "ai-spec-bridge";
    const args = this.options.args ?? [];

    const proc = spawn(cmd, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...this.options.env },
      cwd: this.options.cwd,
    });

    this.process = proc;

    const rl = createInterface({ input: proc.stdout! });

    rl.on("line", (line: string) => {
      if (!line.trim()) return;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(line) as Record<string, unknown>;
      } catch {
        return;
      }

      if ("method" in msg && !("id" in msg && msg["id"] !== null && "result" in msg || "error" in msg)) {
        // Notification: has method, no id (or id is null with no result/error)
        for (const handler of this.notificationHandlers) {
          handler(msg as unknown as JsonRpcNotification);
        }
        return;
      }

      const id = msg["id"];
      if (typeof id === "number") {
        const pending = this.pending.get(id);
        if (pending) {
          this.pending.delete(id);
          if ("error" in msg && msg["error"]) {
            const err = msg["error"] as { code: number; message: string; data?: unknown };
            pending.reject(
              new BridgeClientError(err.code, err.message, err.data),
            );
          } else {
            pending.resolve(msg["result"]);
          }
        }
      }
    });

    proc.on("error", (err) => {
      for (const [, pending] of this.pending) {
        pending.reject(err);
      }
      this.pending.clear();
    });

    proc.on("exit", (code) => {
      if (!this._isClosed) {
        const error = new BridgeClientError(
          -32603,
          `Bridge process exited with code ${code}`,
        );
        for (const [, pending] of this.pending) {
          pending.reject(error);
        }
        this.pending.clear();
      }
    });

    return proc;
  }

  async request(
    method: string,
    params?: unknown,
  ): Promise<unknown> {
    if (this._isClosed) {
      throw new BridgeClientError(-32603, "Transport is closed");
    }

    const proc = this.ensureProcess();
    const id = this.nextId++;

    const request: Record<string, unknown> = {
      jsonrpc: "2.0",
      id,
      method,
    };
    if (params !== undefined && params !== null) {
      request["params"] = params;
    }

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });

      const payload = JSON.stringify(request) + "\n";
      proc.stdin!.write(payload, (err) => {
        if (err) {
          this.pending.delete(id);
          reject(
            new BridgeClientError(-32603, `Failed to write to stdin: ${err.message}`),
          );
        }
      });
    });
  }

  onNotification(handler: (notification: JsonRpcNotification) => void): void {
    this.notificationHandlers.push(handler);
  }

  close(): void {
    this._isClosed = true;
    if (this.process && !this.process.killed) {
      this.process.kill();
      this.process = null;
    }
    for (const [, pending] of this.pending) {
      pending.reject(new BridgeClientError(-32603, "Transport closed"));
    }
    this.pending.clear();
  }
}
