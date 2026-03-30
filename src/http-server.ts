import http from "node:http";
import { URL } from "node:url";
import { BridgeServer } from "./bridge.js";
import { BridgeError } from "./errors.js";
import { API_VERSION } from "./capabilities.js";

const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB

class SseManager {
  private connections = new Map<string, Set<http.ServerResponse>>();

  add(sessionId: string, res: http.ServerResponse): void {
    let subs = this.connections.get(sessionId);
    if (!subs) {
      subs = new Set();
      this.connections.set(sessionId, subs);
    }
    subs.add(res);
  }

  remove(sessionId: string, res: http.ServerResponse): void {
    const subs = this.connections.get(sessionId);
    if (!subs) return;
    subs.delete(res);
    if (subs.size === 0) this.connections.delete(sessionId);
  }

  notify(message: unknown): void {
    if (message === null || typeof message !== "object") return;
    const msg = message as Record<string, unknown>;
    const params = msg["params"];
    if (params === null || typeof params !== "object") return;
    const sessionId = (params as Record<string, unknown>)["sessionId"];
    if (typeof sessionId !== "string") return;

    const subs = this.connections.get(sessionId);
    if (!subs || subs.size === 0) return;

    const method = typeof msg["method"] === "string" ? msg["method"] : "message";
    const eventType = method.includes("/") ? (method.split("/")[1] ?? method) : method;
    const chunk = `event: ${eventType}\ndata: ${JSON.stringify(message)}\n\n`;

    for (const res of subs) {
      try {
        res.write(chunk);
      } catch {
        // closed; will be cleaned up on the "close" event
      }
    }
  }

  closeAll(): void {
    for (const subs of this.connections.values()) {
      for (const res of subs) {
        try {
          res.end();
        } catch {
          // ignore
        }
      }
    }
    this.connections.clear();
  }
}

export interface HttpServerOptions {
  port?: number;
  sessionsDir?: string;
  workspacesDir?: string;
}

export interface HttpServerHandle {
  shutdown: () => Promise<void>;
  port: number;
}

/**
 * Start the HTTP bridge server. Returns a handle with a shutdown function
 * (drains in-flight POST /rpc requests, then closes SSE connections) and
 * the actual bound port (useful when port 0 is passed for a random port).
 */
export function startHttpServer(options: HttpServerOptions = {}): Promise<HttpServerHandle> {
  const { port = 8765, sessionsDir, workspacesDir } = options;
  const corsOrigins = process.env["AI_SPEC_SDK_CORS_ORIGINS"] ?? "*";

  const sseManager = new SseManager();
  const bridge = new BridgeServer({
    notify: (msg) => sseManager.notify(msg),
    sessionsDir,
    workspacesDir,
    transport: "http",
  });

  let inflight = 0;

  const httpServer = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url ?? "/", `http://localhost:${port}`);
    const { pathname } = parsedUrl;

    // CORS headers on every response
    res.setHeader("Access-Control-Allow-Origin", corsOrigins);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // POST /rpc
    if (req.method === "POST" && pathname === "/rpc") {
      const ct = req.headers["content-type"] ?? "";
      if (!ct.includes("application/json")) {
        res.writeHead(415, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Content-Type must be application/json" } }));
        return;
      }

      inflight++;
      try {
        const body = await readBody(req, MAX_BODY_BYTES);
        if (body === null) {
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Request body too large" } }));
          return;
        }

        let payload: unknown;
        try {
          payload = JSON.parse(body) as unknown;
        } catch {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }));
          return;
        }

        let response: unknown;
        try {
          response = await bridge.handleMessage(payload);
        } catch (error) {
          const bridgeError =
            error instanceof BridgeError
              ? error
              : new BridgeError(-32603, "Internal bridge error", {
                  message: error instanceof Error ? error.message : String(error),
                });
          const id =
            payload !== null &&
            typeof payload === "object" &&
            "id" in (payload as object)
              ? (payload as Record<string, unknown>)["id"]
              : null;
          response = { jsonrpc: "2.0", id, error: bridgeError.toJsonRpcError() };
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
      } finally {
        inflight--;
      }
      return;
    }

    // GET /events?sessionId=...
    if (req.method === "GET" && pathname === "/events") {
      const sessionId = parsedUrl.searchParams.get("sessionId");
      if (!sessionId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing sessionId query parameter" }));
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(": connected\n\n");

      sseManager.add(sessionId, res);

      const heartbeat = setInterval(() => {
        try {
          res.write(": heartbeat\n\n");
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      req.on("close", () => {
        clearInterval(heartbeat);
        sseManager.remove(sessionId, res);
      });
      return;
    }

    // GET /health
    if (req.method === "GET" && pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", apiVersion: API_VERSION }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  return new Promise((resolve) => {
    httpServer.listen(port, () => {
      const addr = httpServer.address();
      const boundPort = addr !== null && typeof addr === "object" ? addr.port : port;

      const shutdown = (): Promise<void> =>
        new Promise((done) => {
          // Stop accepting new connections, but don't wait for the close callback
          // since SSE connections are long-lived and would block it.
          httpServer.close();
          const poll = setInterval(() => {
            if (inflight === 0) {
              clearInterval(poll);
              sseManager.closeAll();
              done();
            }
          }, 50);
        });

      resolve({ shutdown, port: boundPort });
    });
  });
}

function readBody(req: http.IncomingMessage, maxBytes: number): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let overflow = false;

    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (overflow) return; // keep draining but stop accumulating
      if (total > maxBytes) {
        overflow = true;
        chunks.length = 0; // free accumulated memory
      } else {
        chunks.push(chunk);
      }
    });

    req.on("end", () => {
      resolve(overflow ? null : Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", () => {
      resolve(null);
    });
  });
}
