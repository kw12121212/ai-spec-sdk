import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { URL } from "node:url";
import { BridgeServer } from "./bridge.js";
import { BridgeError } from "./errors.js";
import { API_VERSION } from "./capabilities.js";
import { loadKeys } from "./key-store.js";
import { verifyKey, checkScope, METHOD_SCOPES } from "./auth.js";

declare const Bun: any;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_HTML_PATH = path.join(__dirname, "ui", "index.html");
const UI_ENABLED = process.env["AI_SPEC_SDK_UI_ENABLED"] !== "false";

const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB

class SseManager {
  private connections = new Map<string, Set<any>>();

  add(sessionId: string, controller: any): void {
    let subs = this.connections.get(sessionId);
    if (!subs) {
      subs = new Set();
      this.connections.set(sessionId, subs);
    }
    subs.add(controller);
  }

  remove(sessionId: string, controller: any): void {
    const subs = this.connections.get(sessionId);
    if (!subs) return;
    subs.delete(controller);
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

    for (const controller of subs) {
      try {
        controller.enqueue(chunk);
      } catch {
        // ignore
      }
    }
  }

  closeAll(): void {
    for (const subs of this.connections.values()) {
      for (const controller of subs) {
        try {
          controller.close();
        } catch {
          // ignore
        }
      }
    }
    this.connections.clear();
  }
}

class WsManager {
  private connections = new Map<string, Set<any>>();

  add(sessionId: string, ws: any): void {
    let subs = this.connections.get(sessionId);
    if (!subs) {
      subs = new Set();
      this.connections.set(sessionId, subs);
    }
    subs.add(ws);
  }

  removeByWs(ws: any): void {
    for (const [sessionId, subs] of this.connections.entries()) {
      if (subs.has(ws)) {
        subs.delete(ws);
        if (subs.size === 0) this.connections.delete(sessionId);
      }
    }
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

    const payload = JSON.stringify(message);

    for (const ws of subs) {
      try {
        ws.send(payload);
      } catch {
        // ignore
      }
    }
  }

  closeAll(): void {
    for (const subs of this.connections.values()) {
      for (const ws of subs) {
        try {
          ws.close(1000, "Server shutting down");
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
  noAuth?: boolean;
  keysFile?: string;
  transport?: string;
}

export interface HttpServerHandle {
  shutdown: () => Promise<void>;
  port: number;
}

export function startHttpServer(options: HttpServerOptions = {}): Promise<HttpServerHandle> {
  const { port = 8765, sessionsDir, workspacesDir, noAuth = false, keysFile, transport = "http" } = options;
  const corsOrigins = process.env["AI_SPEC_SDK_CORS_ORIGINS"] ?? "*";

  const sseManager = new SseManager();
  const wsManager = new WsManager();

  const bridge = new BridgeServer({
    notify: (msg) => {
      sseManager.notify(msg);
      wsManager.notify(msg);
    },
    sessionsDir,
    workspacesDir,
    transport,
    runtimeInfoOptions: {
      transport,
      authMode: noAuth ? "none" : "bearer",
      sessionsDir,
      keysFile,
      httpPort: port,
    },
  });

  let inflight = 0;

  const server = Bun.serve({
    port,
    async fetch(req: any, srv: any) {
      const url = new URL(req.url);
      const pathname = url.pathname;

      const headers = new Headers();
      headers.set("Access-Control-Allow-Origin", corsOrigins);
      headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers });
      }

      if (pathname === "/ws") {
        const token = req.headers.get("authorization")?.slice(7) || url.searchParams.get("token");
        if (srv.upgrade(req, { data: { token } })) {
          return undefined;
        }
        return new Response("Upgrade failed", { status: 500, headers });
      }

      if (req.method === "POST" && pathname === "/rpc") {
        const ct = req.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) {
          headers.set("Content-Type", "application/json");
          return new Response(
            JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Content-Type must be application/json" } }),
            { status: 415, headers }
          );
        }

        inflight++;
        try {
          const bodyBuf = await req.arrayBuffer();
          if (bodyBuf.byteLength > MAX_BODY_BYTES) {
            headers.set("Content-Type", "application/json");
            return new Response(
              JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Request body too large" } }),
              { status: 413, headers }
            );
          }

          let payload: unknown;
          try {
            payload = JSON.parse(new TextDecoder().decode(bodyBuf));
          } catch {
            headers.set("Content-Type", "application/json");
            return new Response(
              JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }),
              { status: 200, headers }
            );
          }

          if (!noAuth) {
            const method = payload !== null && typeof payload === "object" ? ((payload as Record<string, unknown>)["method"] as string | undefined) ?? "" : "";
            const id = payload !== null && typeof payload === "object" && "id" in (payload as object) ? (payload as Record<string, unknown>)["id"] : null;

            const requiredScope = method in METHOD_SCOPES ? METHOD_SCOPES[method] : "admin";
            if (requiredScope !== null) {
              const authHeader = req.headers.get("authorization");
              if (!authHeader || !authHeader.startsWith("Bearer ")) {
                headers.set("Content-Type", "application/json");
                return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32061, message: "Authentication required" } }), { status: 200, headers });
              }
              const token = authHeader.slice(7);
              const keys = loadKeys(keysFile);
              const key = verifyKey(token, keys);
              if (!key) {
                headers.set("Content-Type", "application/json");
                return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32061, message: "Invalid or expired API key" } }), { status: 200, headers });
              }
              if (!checkScope(key, method)) {
                headers.set("Content-Type", "application/json");
                return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32060, message: `Insufficient scope: requires ${requiredScope}` } }), { status: 200, headers });
              }
            }
          }

          let response: unknown;
          try {
            response = await bridge.handleMessage(payload);
          } catch (error) {
            const bridgeError = error instanceof BridgeError ? error : new BridgeError(-32603, "Internal bridge error", { message: error instanceof Error ? error.message : String(error) });
            const id = payload !== null && typeof payload === "object" && "id" in (payload as object) ? (payload as Record<string, unknown>)["id"] : null;
            response = { jsonrpc: "2.0", id, error: bridgeError.toJsonRpcError() };
          }

          headers.set("Content-Type", "application/json");
          return new Response(JSON.stringify(response), { status: 200, headers });
        } finally {
          inflight--;
        }
      }

      if (req.method === "GET" && pathname === "/events") {
        const sessionId = url.searchParams.get("sessionId");
        if (!sessionId) {
          headers.set("Content-Type", "application/json");
          return new Response(JSON.stringify({ error: "Missing sessionId query parameter" }), { status: 400, headers });
        }

        const stream = new ReadableStream({
          start(controller) {
            sseManager.add(sessionId, controller);
            controller.enqueue(": connected\n\n");

            const heartbeat = setInterval(() => {
              try {
                controller.enqueue(": heartbeat\n\n");
              } catch {
                clearInterval(heartbeat);
              }
            }, 30_000);

            req.signal.addEventListener("abort", () => {
              clearInterval(heartbeat);
              sseManager.remove(sessionId, controller);
            });
          },
          cancel(controller) {
            sseManager.remove(sessionId, controller);
          }
        });

        headers.set("Content-Type", "text/event-stream");
        headers.set("Cache-Control", "no-cache");
        headers.set("Connection", "keep-alive");
        return new Response(stream, { status: 200, headers });
      }

      if (req.method === "GET" && pathname === "/health") {
        headers.set("Content-Type", "application/json");
        return new Response(JSON.stringify({ status: "ok", apiVersion: API_VERSION }), { status: 200, headers });
      }

      if (req.method === "GET" && pathname === "/") {
        if (!UI_ENABLED) {
          headers.set("Content-Type", "application/json");
          return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
        }
        try {
          const html = fs.readFileSync(UI_HTML_PATH, "utf8");
          headers.set("Content-Type", "text/html; charset=utf-8");
          return new Response(html, { status: 200, headers });
        } catch {
          headers.set("Content-Type", "application/json");
          return new Response(JSON.stringify({ error: "UI file not found" }), { status: 500, headers });
        }
      }

      headers.set("Content-Type", "application/json");
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
    },
    websocket: {
      message: async (ws: any, message: string) => {
        try {
          const payload = JSON.parse(message);
          
          if (!noAuth) {
            const method = payload?.method ?? "";
            const id = payload?.id ?? null;
            const requiredScope = method in METHOD_SCOPES ? METHOD_SCOPES[method] : "admin";
            
            if (requiredScope !== null && method !== "bridge.capabilities") {
              const token = ws.data?.token;
              if (!token) {
                ws.send(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32061, message: "Authentication required" } }));
                return;
              }
              const keys = loadKeys(keysFile);
              const key = verifyKey(token, keys);
              if (!key) {
                ws.send(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32061, message: "Invalid or expired API key" } }));
                return;
              }
              if (!checkScope(key, method)) {
                ws.send(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32060, message: `Insufficient scope: requires ${requiredScope}` } }));
                return;
              }
            }
          }

          let response: any;
          try {
            response = await bridge.handleMessage(payload);
            const method = payload?.method;
            if ((method === "session.start" || method === "session.resume" || method === "session.status") && response.result?.sessionId) {
              wsManager.add(response.result.sessionId, ws);
            }
          } catch (error) {
            const bridgeError = error instanceof BridgeError ? error : new BridgeError(-32603, "Internal bridge error", { message: String(error) });
            response = { jsonrpc: "2.0", id: payload?.id ?? null, error: bridgeError.toJsonRpcError() };
          }
          ws.send(JSON.stringify(response));
        } catch (e) {
          // ignore parsing errors
        }
      },
      open(ws: any) { },
      close(ws: any) {
        wsManager.removeByWs(ws);
      },
    },
  });

  return Promise.resolve({
    shutdown: async () => {
      return new Promise<void>((resolve) => {
        server.stop();
        const poll = setInterval(() => {
          if (inflight === 0) {
            clearInterval(poll);
            sseManager.closeAll();
            wsManager.closeAll();
            resolve();
          }
        }, 50);
      });
    },
    port: server.port
  });
}
