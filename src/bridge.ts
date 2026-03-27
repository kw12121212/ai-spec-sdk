import path from "node:path";
import fs from "node:fs";
import { BridgeError, isJsonRpcRequest } from "./errors.js";
import { getCapabilities, BUILTIN_SPEC_SKILLS } from "./capabilities.js";
import { runWorkflow } from "./workflow.js";
import { SessionStore } from "./session-store.js";
import { runClaudeQuery } from "./claude-agent-runner.js";

const METHOD_NOT_FOUND = -32601;
const INTERNAL_ERROR = -32603;
const SDK_SESSION_ID_UNAVAILABLE = -32012;

export interface ProxyParams {
  http?: string;
  https?: string;
  noProxy?: string;
}

const PROXY_KNOWN_KEYS = new Set(["http", "https", "noProxy"]);

function validateProxy(proxy: unknown): ProxyParams {
  if (proxy === null || proxy === undefined) {
    return {};
  }
  if (typeof proxy !== "object" || Array.isArray(proxy)) {
    throw new BridgeError(-32602, "'proxy' must be an object");
  }
  const p = proxy as Record<string, unknown>;
  for (const key of Object.keys(p)) {
    if (!PROXY_KNOWN_KEYS.has(key)) {
      throw new BridgeError(-32602, `Unknown proxy field: '${key}'. Allowed fields: http, https, noProxy`);
    }
  }
  const result: ProxyParams = {};
  if (p["http"] !== undefined) {
    if (typeof p["http"] !== "string") throw new BridgeError(-32602, "'proxy.http' must be a string");
    result.http = p["http"];
  }
  if (p["https"] !== undefined) {
    if (typeof p["https"] !== "string") throw new BridgeError(-32602, "'proxy.https' must be a string");
    result.https = p["https"];
  }
  if (p["noProxy"] !== undefined) {
    if (typeof p["noProxy"] !== "string") throw new BridgeError(-32602, "'proxy.noProxy' must be a string");
    result.noProxy = p["noProxy"];
  }
  return result;
}

function buildProxyEnv(proxy: ProxyParams): Record<string, string> {
  const env: Record<string, string> = {};
  if (proxy.http !== undefined) env["HTTP_PROXY"] = proxy.http;
  if (proxy.https !== undefined) env["HTTPS_PROXY"] = proxy.https;
  if (proxy.noProxy !== undefined) env["NO_PROXY"] = proxy.noProxy;
  return env;
}

function mergeEnv(
  callerEnv: Record<string, string | undefined> | undefined,
  proxyEnv: Record<string, string>,
): Record<string, string | undefined> | undefined {
  const merged = { ...(callerEnv ?? {}), ...proxyEnv };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: unknown;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface BridgeServerOptions {
  notify?: (message: unknown) => void;
}

interface AgentQueryContext {
  cwd: string;
  env: Record<string, string | undefined> | undefined;
}

export class BridgeServer {
  private notify: (message: unknown) => void;
  private sessionStore: SessionStore;

  constructor({ notify = () => {} }: BridgeServerOptions = {}) {
    this.notify = notify;
    this.sessionStore = new SessionStore();
  }

  async handleMessage(payload: unknown): Promise<JsonRpcResponse> {
    const id =
      payload !== null &&
      typeof payload === "object" &&
      Object.prototype.hasOwnProperty.call(payload, "id")
        ? (payload as Record<string, unknown>)["id"]
        : null;

    if (!isJsonRpcRequest(payload)) {
      return {
        jsonrpc: "2.0",
        id,
        error: new BridgeError(-32600, "Invalid JSON-RPC request").toJsonRpcError(),
      };
    }

    const request = payload as JsonRpcRequest;

    try {
      const result = await this.dispatch(request.method, request.params ?? {}, request.id);
      return {
        jsonrpc: "2.0",
        id,
        result,
      };
    } catch (error) {
      const bridgeError =
        error instanceof BridgeError
          ? error
          : new BridgeError(INTERNAL_ERROR, "Internal bridge error", {
              message: (error as Error).message,
            });

      return {
        jsonrpc: "2.0",
        id,
        error: bridgeError.toJsonRpcError(),
      };
    }
  }

  private async dispatch(
    method: string,
    params: Record<string, unknown>,
    requestId: unknown,
  ): Promise<unknown> {
    switch (method) {
      case "bridge.capabilities":
        return getCapabilities();
      case "skills.list":
        return { skills: BUILTIN_SPEC_SKILLS };
      case "workflow.run":
        return runWorkflow(
          params as { workspace: unknown; workflow: unknown; args?: unknown[] },
          (event, payload) => {
            this.emit(event, payload, requestId);
          },
        );
      case "session.start":
        return this.startSession(params, requestId);
      case "session.resume":
        return this.resumeSession(params, requestId);
      case "session.stop":
        return this.stopSession(params);
      case "session.status":
        return this.getSessionStatus(params);
      default:
        throw new BridgeError(METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
  }

  private emit(method: string, params: Record<string, unknown>, requestId: unknown = null): void {
    this.notify({
      jsonrpc: "2.0",
      method,
      params: {
        ...params,
        requestId,
      },
    });
  }

  private async startSession(
    params: Record<string, unknown>,
    requestId: unknown,
  ): Promise<unknown> {
    const { workspace, prompt, options = {}, proxy } = params;

    if (!workspace || typeof workspace !== "string") {
      throw new BridgeError(-32602, "'workspace' must be provided");
    }

    if (!prompt || typeof prompt !== "string") {
      throw new BridgeError(-32602, "'prompt' must be provided");
    }

    const typedOptions = options as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(typedOptions, "cwd")) {
      throw new BridgeError(
        -32602,
        "'cwd' must not be set in options; it is bridge-managed via 'workspace'",
      );
    }

    const resolvedWorkspace = path.resolve(workspace);
    if (!fs.existsSync(resolvedWorkspace) || !fs.statSync(resolvedWorkspace).isDirectory()) {
      throw new BridgeError(-32001, "Workspace path does not exist", {
        workspace: resolvedWorkspace,
      });
    }

    const proxyParams = validateProxy(proxy);
    const proxyEnv = buildProxyEnv(proxyParams);
    const { env: callerEnv, ...passthroughOptions } = typedOptions;
    const resolvedEnv = mergeEnv(
      callerEnv as Record<string, string | undefined> | undefined,
      proxyEnv,
    );

    const session = this.sessionStore.create(resolvedWorkspace, prompt);

    this.emit(
      "bridge/session_event",
      { sessionId: session.id, type: "session_started" },
      requestId,
    );

    return this._runQuery(session, prompt, passthroughOptions, { cwd: resolvedWorkspace, env: resolvedEnv }, requestId);
  }

  private async resumeSession(
    params: Record<string, unknown>,
    requestId: unknown,
  ): Promise<unknown> {
    const { sessionId, prompt, options = {}, proxy } = params;

    if (!sessionId || typeof sessionId !== "string") {
      throw new BridgeError(-32602, "'sessionId' must be provided");
    }

    const session = this.sessionStore.get(sessionId);
    if (!session) {
      throw new BridgeError(-32011, "Session not found", { sessionId });
    }

    if (!prompt || typeof prompt !== "string") {
      throw new BridgeError(-32602, "'prompt' must be provided");
    }

    const typedOptions = options as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(typedOptions, "cwd")) {
      throw new BridgeError(
        -32602,
        "'cwd' must not be set in options; it is bridge-managed via 'workspace'",
      );
    }

    if (!session.sdkSessionId) {
      throw new BridgeError(SDK_SESSION_ID_UNAVAILABLE, "Session SDK ID not available", {
        sessionId,
      });
    }

    const proxyParams = validateProxy(proxy);
    const proxyEnv = buildProxyEnv(proxyParams);
    const { env: callerEnv, ...passthroughOptions } = typedOptions;
    const resolvedEnv = mergeEnv(
      callerEnv as Record<string, string | undefined> | undefined,
      proxyEnv,
    );

    this.sessionStore.appendEvent(session.id, { type: "resume_prompt", prompt });

    this.emit(
      "bridge/session_event",
      { sessionId: session.id, type: "session_resumed" },
      requestId,
    );

    return this._runQuery(
      session,
      prompt,
      { ...passthroughOptions, resume: session.sdkSessionId },
      { cwd: session.workspace, env: resolvedEnv },
      requestId,
    );
  }

  private async _runQuery(
    session: { id: string },
    prompt: string,
    options: Record<string, unknown>,
    context: AgentQueryContext,
    requestId: unknown,
  ): Promise<unknown> {
    const queryResult = await runClaudeQuery({
      prompt,
      options,
      cwd: context.cwd,
      env: context.env,
      shouldStop: () => {
        const current = this.sessionStore.get(session.id);
        return Boolean(current?.stopRequested);
      },
      onEvent: (message) => {
        const current = this.sessionStore.get(session.id);
        if (current?.stopRequested) {
          return;
        }

        if (
          message !== null &&
          typeof message === "object" &&
          (message as Record<string, unknown>)["type"] === "system" &&
          (message as Record<string, unknown>)["subtype"] === "init" &&
          typeof (message as Record<string, unknown>)["session_id"] === "string"
        ) {
          this.sessionStore.setSdkSessionId(
            session.id,
            (message as Record<string, unknown>)["session_id"] as string,
          );
        }

        this.sessionStore.appendEvent(session.id, {
          type: "agent_message",
          message,
        });

        this.emit(
          "bridge/session_event",
          { sessionId: session.id, type: "agent_message", message },
          requestId,
        );
      },
    });

    if (queryResult.status === "stopped") {
      const stopped = this.sessionStore.stop(session.id);
      this.emit(
        "bridge/session_event",
        {
          sessionId: session.id,
          type: "session_stopped",
          status: stopped ? stopped.status : "stopped",
        },
        requestId,
      );

      return { sessionId: session.id, status: "stopped", result: null };
    }

    this.sessionStore.complete(session.id, queryResult.result);

    this.emit(
      "bridge/session_event",
      { sessionId: session.id, type: "session_completed", result: queryResult.result },
      requestId,
    );

    return { sessionId: session.id, status: "completed", result: queryResult.result };
  }

  private stopSession(params: Record<string, unknown>): unknown {
    const { sessionId } = params;
    if (!sessionId || typeof sessionId !== "string") {
      throw new BridgeError(-32602, "'sessionId' must be provided");
    }

    const session = this.sessionStore.stop(sessionId);
    if (!session) {
      throw new BridgeError(-32011, "Session not found", { sessionId });
    }

    return { sessionId, status: session.status };
  }

  private getSessionStatus(params: Record<string, unknown>): unknown {
    const { sessionId } = params;
    if (!sessionId || typeof sessionId !== "string") {
      throw new BridgeError(-32602, "'sessionId' must be provided");
    }

    const session = this.sessionStore.get(sessionId);
    if (!session) {
      throw new BridgeError(-32011, "Session not found", { sessionId });
    }

    return {
      sessionId,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      historyLength: session.history.length,
      result: session.result,
    };
  }
}
