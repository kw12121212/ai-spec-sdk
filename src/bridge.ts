import path from "node:path";
import fs from "node:fs";
import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { BridgeError, isJsonRpcRequest } from "./errors.js";
import { getCapabilities, BUILTIN_SPEC_SKILLS, SUPPORTED_MODELS, BUILTIN_TOOLS } from "./capabilities.js";
import { runWorkflow } from "./workflow.js";
import { SessionStore } from "./session-store.js";
import { WorkspaceStore } from "./workspace-store.js";
import { runClaudeQuery } from "./claude-agent-runner.js";

const METHOD_NOT_FOUND = -32601;
const INTERNAL_ERROR = -32603;
const SDK_SESSION_ID_UNAVAILABLE = -32012;

const EVENT_BUFFER_CAP = 500;

interface BufferedEvent {
  seq: number;
  payload: Record<string, unknown>;
}

const PERMISSION_MODES = new Set(["default", "acceptEdits", "bypassPermissions", "approve"]);
const APPROVAL_NOT_FOUND = -32020;
const DEFAULT_PERMISSION_MODE = "bypassPermissions";

interface AgentControlParams {
  model?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode: string;
  maxTurns?: number;
  systemPrompt?: string;
}

function validateAgentControlParams(raw: Record<string, unknown>): AgentControlParams {
  const result: AgentControlParams = { permissionMode: DEFAULT_PERMISSION_MODE };

  if (raw["model"] !== undefined) {
    if (typeof raw["model"] !== "string") throw new BridgeError(-32602, "'model' must be a string");
    result.model = raw["model"];
  }

  if (raw["allowedTools"] !== undefined) {
    if (
      !Array.isArray(raw["allowedTools"]) ||
      !(raw["allowedTools"] as unknown[]).every((t) => typeof t === "string")
    ) {
      throw new BridgeError(-32602, "'allowedTools' must be an array of strings");
    }
    result.allowedTools = raw["allowedTools"] as string[];
  }

  if (raw["disallowedTools"] !== undefined) {
    if (
      !Array.isArray(raw["disallowedTools"]) ||
      !(raw["disallowedTools"] as unknown[]).every((t) => typeof t === "string")
    ) {
      throw new BridgeError(-32602, "'disallowedTools' must be an array of strings");
    }
    result.disallowedTools = raw["disallowedTools"] as string[];
  }

  if (raw["permissionMode"] !== undefined) {
    if (typeof raw["permissionMode"] !== "string" || !PERMISSION_MODES.has(raw["permissionMode"])) {
      throw new BridgeError(
        -32602,
        `'permissionMode' must be one of: ${[...PERMISSION_MODES].join(", ")}`,
      );
    }
    result.permissionMode = raw["permissionMode"];
  }

  if (raw["maxTurns"] !== undefined) {
    if (
      typeof raw["maxTurns"] !== "number" ||
      !Number.isInteger(raw["maxTurns"]) ||
      raw["maxTurns"] < 1
    ) {
      throw new BridgeError(-32602, "'maxTurns' must be an integer >= 1");
    }
    result.maxTurns = raw["maxTurns"];
  }

  if (raw["systemPrompt"] !== undefined) {
    if (typeof raw["systemPrompt"] !== "string")
      throw new BridgeError(-32602, "'systemPrompt' must be a string");
    result.systemPrompt = raw["systemPrompt"];
  }

  return result;
}

function buildControlOptions(control: AgentControlParams): Record<string, unknown> {
  const opts: Record<string, unknown> = { permissionMode: control.permissionMode };
  if (control.model !== undefined) opts["model"] = control.model;
  if (control.allowedTools !== undefined) opts["allowedTools"] = control.allowedTools;
  if (control.disallowedTools !== undefined) opts["disallowedTools"] = control.disallowedTools;
  if (control.maxTurns !== undefined) opts["maxTurns"] = control.maxTurns;
  if (control.systemPrompt !== undefined) opts["systemPrompt"] = control.systemPrompt;
  return opts;
}

function classifyMessageType(message: unknown): string {
  if (message === null || typeof message !== "object") return "other";
  const msg = message as Record<string, unknown>;

  if (msg["type"] === "system" && msg["subtype"] === "init") return "system_init";
  if (msg["type"] === "result") return "result";

  if (msg["type"] === "assistant") {
    const innerMsg = msg["message"] as Record<string, unknown> | undefined;
    const content = innerMsg?.["content"] ?? msg["content"];
    if (Array.isArray(content)) {
      const blocks = content as Array<Record<string, unknown>>;
      if (blocks.some((b) => b["type"] === "tool_use")) return "tool_use";
      if (blocks.some((b) => b["type"] === "text")) return "assistant_text";
    }
  }

  if (msg["type"] === "user") {
    const innerMsg = msg["message"] as Record<string, unknown> | undefined;
    const content = innerMsg?.["content"] ?? msg["content"];
    if (Array.isArray(content)) {
      const blocks = content as Array<Record<string, unknown>>;
      if (blocks.some((b) => b["type"] === "tool_result")) return "tool_result";
    }
  }

  return "other";
}

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
  sessionsDir?: string;
  workspacesDir?: string;
}

interface AgentQueryContext {
  cwd: string;
  env: Record<string, string | undefined> | undefined;
}

interface PendingApproval {
  resolve: (result: PermissionResult) => void;
  sessionId: string;
}

export class BridgeServer {
  private notify: (message: unknown) => void;
  private sessionStore: SessionStore;
  private workspaceStore: WorkspaceStore;
  private eventLog: Map<string, BufferedEvent[]>;
  private eventSeq: Map<string, number>;
  private pendingApprovals: Map<string, PendingApproval>;

  constructor({ notify = () => {}, sessionsDir, workspacesDir }: BridgeServerOptions = {}) {
    this.notify = notify;
    this.sessionStore = new SessionStore(sessionsDir);
    this.workspaceStore = new WorkspaceStore(workspacesDir);
    this.eventLog = new Map();
    this.eventSeq = new Map();
    this.pendingApprovals = new Map();
  }

  private _buildApprovalCallback(sessionId: string): (
    toolName: string,
    input: Record<string, unknown>,
    opts: { signal: AbortSignal; title?: string; displayName?: string; description?: string; toolUseID: string }
  ) => Promise<PermissionResult> {
    return (toolName, input, opts) => {
      const requestId = crypto.randomUUID();
      return new Promise<PermissionResult>((resolve) => {
        this.pendingApprovals.set(requestId, { resolve, sessionId });

        opts.signal.addEventListener("abort", () => {
          if (this.pendingApprovals.delete(requestId)) {
            resolve({ behavior: "deny", message: "Tool call aborted" });
          }
        }, { once: true });

        // Call notify directly — using this.emit would overwrite our requestId
        // with the RPC context requestId (a different concept).
        this.notify({
          jsonrpc: "2.0",
          method: "bridge/tool_approval_requested",
          params: {
            sessionId,
            requestId,
            toolName,
            input,
            ...(opts.title !== undefined && { title: opts.title }),
            ...(opts.displayName !== undefined && { displayName: opts.displayName }),
            ...(opts.description !== undefined && { description: opts.description }),
          },
        });
      });
    };
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
      case "bridge.ping":
        return { pong: true, ts: new Date().toISOString() };
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
      case "session.list":
        return this.listSessions(params);
      case "session.history":
        return this.getSessionHistory(params);
      case "session.events":
        return this.getSessionEvents(params);
      case "models.list":
        return { models: SUPPORTED_MODELS };
      case "tools.list":
        return { tools: BUILTIN_TOOLS };
      case "workspace.register":
        return this.registerWorkspace(params);
      case "workspace.list":
        return { workspaces: this.workspaceStore.list() };
      case "session.approveTool":
        return this.resolveApproval(params, { behavior: "allow" });
      case "session.rejectTool":
        return this.resolveApproval(params, {
          behavior: "deny",
          message: typeof params["message"] === "string" ? params["message"] : "Tool use rejected by user",
        });
      default:
        throw new BridgeError(METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
  }

  private emit(method: string, params: Record<string, unknown>, requestId: unknown = null): void {
    const payload = { ...params, requestId };
    this.notify({ jsonrpc: "2.0", method, params: payload });

    if (method === "bridge/session_event" && typeof params["sessionId"] === "string") {
      const sid = params["sessionId"] as string;
      const seq = this.eventSeq.get(sid) ?? 0;
      this.eventSeq.set(sid, seq + 1);

      const buf = this.eventLog.get(sid) ?? [];
      buf.push({ seq, payload });
      if (buf.length > EVENT_BUFFER_CAP) buf.shift();
      this.eventLog.set(sid, buf);
    }
  }

  private async startSession(
    params: Record<string, unknown>,
    requestId: unknown,
  ): Promise<unknown> {
    const { workspace, prompt, options = {}, proxy } = params;
    const { model, allowedTools, disallowedTools, permissionMode, maxTurns, systemPrompt } = params;

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

    const controlParams = validateAgentControlParams({ model, allowedTools, disallowedTools, permissionMode, maxTurns, systemPrompt });

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

    return this._runQuery(
      session,
      prompt,
      { ...passthroughOptions, ...buildControlOptions(controlParams) },
      { cwd: resolvedWorkspace, env: resolvedEnv },
      requestId,
    );
  }

  private async resumeSession(
    params: Record<string, unknown>,
    requestId: unknown,
  ): Promise<unknown> {
    const { sessionId, prompt, options = {}, proxy } = params;
    const { model, allowedTools, disallowedTools, permissionMode, maxTurns, systemPrompt } = params;

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

    const controlParams = validateAgentControlParams({ model, allowedTools, disallowedTools, permissionMode, maxTurns, systemPrompt });

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
      { ...passthroughOptions, resume: session.sdkSessionId, ...buildControlOptions(controlParams) },
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
    let resolvedOptions = options;
    if (options["permissionMode"] === "approve") {
      resolvedOptions = {
        ...options,
        permissionMode: "default",
        canUseTool: this._buildApprovalCallback(session.id),
      };
    }

    const queryResult = await runClaudeQuery({
      prompt,
      options: resolvedOptions,
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
          { sessionId: session.id, type: "agent_message", messageType: classifyMessageType(message), message },
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

      return { sessionId: session.id, status: "stopped", result: null, usage: null };
    }

    this.sessionStore.complete(session.id, queryResult.result);

    this.emit(
      "bridge/session_event",
      {
        sessionId: session.id,
        type: "session_completed",
        result: queryResult.result,
        usage: queryResult.usage,
      },
      requestId,
    );

    return { sessionId: session.id, status: "completed", result: queryResult.result, usage: queryResult.usage };
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

    for (const [reqId, pending] of this.pendingApprovals) {
      if (pending.sessionId === sessionId) {
        this.pendingApprovals.delete(reqId);
        pending.resolve({ behavior: "deny", message: "Session stopped" });
      }
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

  private getSessionHistory(params: Record<string, unknown>): unknown {
    const { sessionId, offset, limit } = params;

    if (!sessionId || typeof sessionId !== "string") {
      throw new BridgeError(-32602, "'sessionId' must be provided");
    }

    if (offset !== undefined && (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0)) {
      throw new BridgeError(-32602, "'offset' must be a non-negative integer");
    }

    if (limit !== undefined && (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1)) {
      throw new BridgeError(-32602, "'limit' must be a positive integer");
    }

    const session = this.sessionStore.get(sessionId);
    if (!session) {
      throw new BridgeError(-32011, "Session not found", { sessionId });
    }

    const resolvedOffset = typeof offset === "number" ? offset : 0;
    const resolvedLimit = Math.min(typeof limit === "number" ? limit : 50, 200);
    const entries = session.history.slice(resolvedOffset, resolvedOffset + resolvedLimit);

    return {
      sessionId,
      total: session.history.length,
      entries,
    };
  }

  private getSessionEvents(params: Record<string, unknown>): unknown {
    const { sessionId, since, limit } = params;

    if (!sessionId || typeof sessionId !== "string") {
      throw new BridgeError(-32602, "'sessionId' must be provided");
    }

    if (since !== undefined && (typeof since !== "number" || !Number.isInteger(since) || since < 0)) {
      throw new BridgeError(-32602, "'since' must be a non-negative integer");
    }

    if (limit !== undefined && (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1)) {
      throw new BridgeError(-32602, "'limit' must be a positive integer");
    }

    if (!this.sessionStore.get(sessionId)) {
      throw new BridgeError(-32011, "Session not found", { sessionId });
    }

    const buf = this.eventLog.get(sessionId) ?? [];
    const sinceSeq = typeof since === "number" ? since : 0;
    const resolvedLimit = Math.min(typeof limit === "number" ? limit : 50, 500);
    const filtered = buf.filter((e) => e.seq >= sinceSeq).slice(0, resolvedLimit);

    return { sessionId, events: filtered, total: buf.length };
  }

  private resolveApproval(params: Record<string, unknown>, result: PermissionResult): unknown {
    const { sessionId, requestId } = params;

    if (!sessionId || typeof sessionId !== "string") {
      throw new BridgeError(-32602, "'sessionId' must be provided");
    }
    if (!requestId || typeof requestId !== "string") {
      throw new BridgeError(-32602, "'requestId' must be provided");
    }

    if (!this.sessionStore.get(sessionId)) {
      throw new BridgeError(-32011, "Session not found", { sessionId });
    }

    const pending = this.pendingApprovals.get(requestId);
    if (!pending || pending.sessionId !== sessionId) {
      throw new BridgeError(APPROVAL_NOT_FOUND, "Approval request not found", { requestId });
    }

    this.pendingApprovals.delete(requestId);
    pending.resolve(result);
    return { requestId, behavior: result.behavior };
  }

  private registerWorkspace(params: Record<string, unknown>): unknown {
    const { workspace } = params;
    if (!workspace || typeof workspace !== "string") {
      throw new BridgeError(-32602, "'workspace' must be provided");
    }

    const resolved = path.resolve(workspace);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new BridgeError(-32001, "Workspace path does not exist", { workspace: resolved });
    }

    const entry = this.workspaceStore.register(resolved);
    return { workspace: entry };
  }

  private listSessions(params: Record<string, unknown>): unknown {
    const { status } = params;

    if (status !== undefined && status !== "active" && status !== "all") {
      throw new BridgeError(-32602, "'status' must be 'active' or 'all'");
    }

    const sessions = this.sessionStore.list(status as "active" | "all" | undefined);

    return {
      sessions: sessions.map((s) => {
        const firstPromptEntry = s.history.find((e) => e.type === "user_prompt");
        const prompt = firstPromptEntry?.prompt
          ? firstPromptEntry.prompt.slice(0, 200)
          : null;
        return {
          sessionId: s.id,
          status: s.status,
          workspace: s.workspace,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          prompt,
        };
      }),
    };
  }
}
