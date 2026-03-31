import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { BridgeClientError } from "./errors.js";
export class StdioTransport {
    options;
    process = null;
    nextId = 1;
    pending = new Map();
    notificationHandlers = [];
    _isClosed = false;
    constructor(options = {}) {
        this.options = options;
    }
    get isClosed() {
        return this._isClosed;
    }
    ensureProcess() {
        if (this.process && !this.process.killed)
            return this.process;
        const cmd = this.options.command ?? "ai-spec-bridge";
        const args = this.options.args ?? [];
        const proc = spawn(cmd, args, {
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env, ...this.options.env },
            cwd: this.options.cwd,
        });
        this.process = proc;
        const rl = createInterface({ input: proc.stdout });
        rl.on("line", (line) => {
            if (!line.trim())
                return;
            let msg;
            try {
                msg = JSON.parse(line);
            }
            catch {
                return;
            }
            if ("method" in msg && !("id" in msg && msg["id"] !== null && "result" in msg || "error" in msg)) {
                // Notification: has method, no id (or id is null with no result/error)
                for (const handler of this.notificationHandlers) {
                    handler(msg);
                }
                return;
            }
            const id = msg["id"];
            if (typeof id === "number") {
                const pending = this.pending.get(id);
                if (pending) {
                    this.pending.delete(id);
                    if ("error" in msg && msg["error"]) {
                        const err = msg["error"];
                        pending.reject(new BridgeClientError(err.code, err.message, err.data));
                    }
                    else {
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
                const error = new BridgeClientError(-32603, `Bridge process exited with code ${code}`);
                for (const [, pending] of this.pending) {
                    pending.reject(error);
                }
                this.pending.clear();
            }
        });
        return proc;
    }
    async request(method, params) {
        if (this._isClosed) {
            throw new BridgeClientError(-32603, "Transport is closed");
        }
        const proc = this.ensureProcess();
        const id = this.nextId++;
        const request = {
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
            proc.stdin.write(payload, (err) => {
                if (err) {
                    this.pending.delete(id);
                    reject(new BridgeClientError(-32603, `Failed to write to stdin: ${err.message}`));
                }
            });
        });
    }
    onNotification(handler) {
        this.notificationHandlers.push(handler);
    }
    close() {
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
//# sourceMappingURL=stdio-transport.js.map