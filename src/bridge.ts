import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { BridgeError, isJsonRpcRequest } from "./errors.js";
import { getCapabilities, BUILTIN_SPEC_SKILLS, SUPPORTED_MODELS, BUILTIN_TOOLS, API_VERSION } from "./capabilities.js";
import { runWorkflow } from "./workflow.js";
import { SessionStore } from "./session-store.js";
import { WorkspaceStore, type CustomTool } from "./workspace-store.js";
import { McpStore } from "./mcp-store.js";
import type { McpServerConfig } from "./mcp-store.js";
import { ConfigStore } from "./config-store.js";
import { HooksStore } from "./hooks-store.js";
import type { HookEvent } from "./hooks-store.js";
import { ContextStore } from "./context-store.js";
import { runClaudeQuery, type QueryResult as ClaudeQueryResult } from "./claude-agent-runner.js";
import { defaultLogger, VALID_LOG_LEVELS, type Logger, type LogLevel } from "./logger.js";
import { buildRuntimeInfo, type RuntimeInfoOptions } from "./runtime-info.js";
import { WebhookManager } from "./webhooks.js";
import { TemplateStore } from "./template-store.js";
import { AuditLog } from "./audit-log.js";
import { providerRegistry } from "./llm-provider/provider-registry.js";
import { balancerRegistry } from "./llm-provider/balancer-registry.js";
import type { BalancerConfig } from "./llm-provider/types.js";
import { getTokenStore } from "./token-tracking/store.js";
import { counterRegistry } from "./token-tracking/counters/index.js";
import { getQuotaRegistry } from "./quota/registry.js";
import { validateQuotaRule } from "./quota/types.js";
import { buildQuotaStatuses } from "./quota/enforcer.js";
import type { QuotaStatus, QuotaWarning, QuotaBlockedNotification } from "./quota/types.js";

const METHOD_NOT_FOUND = -32601;
const INTERNAL_ERROR = -32603;
const SDK_SESSION_ID_UNAVAILABLE = -32012;
const VERSION_MISMATCH = -32050;
const SESSION_ACTIVE = -32070;
const TEMPLATE_NOT_FOUND = -32021;

const EVENT_BUFFER_CAP = 500;

interface BufferedEvent {
  seq: number;
  payload: Record<string, unknown>;
}

const PERMISSION_MODES = new Set(["default", "acceptEdits", "bypassPermissions", "approve"]);
const APPROVAL_NOT_FOUND = -32020;
const DEFAULT_PERMISSION_MODE = "bypassPermissions";
const QUOTA_EXCEEDED = -32060;
const QUOTA_NOT_FOUND = -32061;
const BALANCER_ALL_EXCLUDED = -32005;

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

/**
 * Check if a message is a streaming partial message (SDKPartialAssistantMessage)
 * with type === 'stream_event' and event.type === 'content_block_delta'.
 */
function isStreamEvent(message: unknown): boolean {
  if (message === null || typeof message !== "object") return false;
  const msg = message as Record<string, unknown>;
  if (msg["type"] !== "stream_event") return false;
  const event = msg["event"] as Record<string, unknown> | undefined;
  if (!event || typeof event !== "object") return false;
  return event["type"] === "content_block_delta";
}

/**
 * Extract the text delta from a streaming partial message.
 * Returns null if the event is not a text_delta.
 */
function extractTextDelta(message: unknown): string | null {
  if (message === null || typeof message !== "object") return null;
  const msg = message as Record<string, unknown>;
  const event = msg["event"] as Record<string, unknown> | undefined;
  if (!event || typeof event !== "object") return null;
  const delta = event["delta"] as Record<string, unknown> | undefined;
  if (!delta || typeof delta !== "object") return null;
  if (delta["type"] !== "text_delta") return null;
  return typeof delta["text"] === "string" ? delta["text"] : null;
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
  logger?: Logger;
  transport?: string;
  /** Options forwarded to buildRuntimeInfo for bridge.info responses. */
  runtimeInfoOptions?: RuntimeInfoOptions;
  auditDir?: string;
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
  private logger: Logger;
  private transport: string;
  private runtimeInfoOptions: RuntimeInfoOptions;
  private sessionStore: SessionStore;
  private workspaceStore: WorkspaceStore;
  private mcpStore: McpStore;
  private configStore: ConfigStore;
  private hooksStore: HooksStore;
  private contextStore: ContextStore;
  private eventLog: Map<string, BufferedEvent[]>;
  private eventSeq: Map<string, number>;
  private pendingApprovals: Map<string, PendingApproval>;
  private webhookManager: WebhookManager;
  private templateStore: TemplateStore;
  private auditLog: AuditLog;
  private abortControllers: Map<string, AbortController>;
  private timeoutIds: Map<string, NodeJS.Timeout>;

  constructor({ notify = () => {}, sessionsDir, workspacesDir, logger, transport = "stdio", runtimeInfoOptions, auditDir }: BridgeServerOptions = {}) {
    this.notify = notify;
    this.logger = logger ?? defaultLogger;
    this.transport = transport;
    this.runtimeInfoOptions = { transport, sessionsDir, ...runtimeInfoOptions };
    const resolvedAuditDir = auditDir ?? (sessionsDir ? path.join(sessionsDir, "audit") : undefined);
    this.auditLog = new AuditLog(resolvedAuditDir ?? ".audit", notify, API_VERSION);
    this.sessionStore = new SessionStore(sessionsDir, this.auditLog);
    providerRegistry.setSessionGetter((id) => this.sessionStore.get(id) ?? undefined);
    balancerRegistry.setEventCallbacks({
      onExcluded: (bid, pid, reason, excludedUntil) => {
        this.emit("bridge/balancer_provider_excluded", { balancerId: bid, providerId: pid, reason, excludedUntil });
      },
      onReadmitted: (bid, pid) => {
        this.emit("bridge/balancer_provider_readmitted", { balancerId: bid, providerId: pid });
      },
    });
    this.workspaceStore = new WorkspaceStore(workspacesDir);
    this.mcpStore = new McpStore((method, params) => {
      this.notify({ jsonrpc: "2.0", method, params });
    });
    this.configStore = new ConfigStore();
    this.hooksStore = new HooksStore();
    this.contextStore = new ContextStore();
    this.eventLog = new Map();
    this.eventSeq = new Map();
    this.pendingApprovals = new Map();
    this.webhookManager = new WebhookManager(sessionsDir);
    this.templateStore = new TemplateStore(sessionsDir ? path.join(sessionsDir, "templates") : undefined);
    this.abortControllers = new Map();
    this.timeoutIds = new Map();

    const activeSessionIds = new Set(this.sessionStore.list({ status: "all" }).map((s) => s.id));
    const removedCount = this.auditLog.cleanup(30, activeSessionIds);
    if (removedCount > 0) {
      this.logger.info(`cleaned up ${removedCount} stale audit log files`);
    }
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
    const start = Date.now();

    try {
      const result = await this.dispatch(request.method, request.params ?? {}, request.id);
      this.logger.debug("dispatch completed", { method: request.method, durationMs: Date.now() - start });
      return {
        jsonrpc: "2.0",
        id,
        result,
      };
    } catch (error) {
      const err = error as Error & { code?: number; quotaData?: unknown };
      let bridgeError: BridgeError;

      if (err.code === QUOTA_EXCEEDED) {
        bridgeError = new BridgeError(QUOTA_EXCEEDED, "Quota limit exceeded", {
          ...(typeof err.quotaData === "object" && err.quotaData !== null ? err.quotaData as Record<string, unknown> : {}),
          message: err.message,
        });
      } else if (error instanceof BridgeError) {
        bridgeError = error;
      } else {
        bridgeError = new BridgeError(INTERNAL_ERROR, "Internal bridge error", {
          message: err.message,
        });
      }

      this.logger.error("dispatch error", {
        method: request.method,
        durationMs: Date.now() - start,
        error: bridgeError.message,
        code: bridgeError.code,
        stack: err.stack,
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
    // Per-request version validation (opt-in)
    if (params["apiVersion"] !== undefined) {
      if (typeof params["apiVersion"] !== "string" || params["apiVersion"] !== API_VERSION) {
        throw new BridgeError(VERSION_MISMATCH, `Unsupported API version: ${params["apiVersion"]}`, {
          supportedVersions: [API_VERSION],
        });
      }
    }

    switch (method) {
      case "bridge.capabilities":
        return getCapabilities(this.transport);
      case "bridge.negotiateVersion":
        return this.negotiateVersion(params);
      case "bridge.setLogLevel":
        return this.setLogLevel(params);
      case "bridge.ping":
        return { pong: true, ts: new Date().toISOString() };
      case "bridge.info":
        return buildRuntimeInfo(this.runtimeInfoOptions);
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
      case "session.spawn":
        return this.spawnSession(params, requestId);
      case "session.resume":
        return this.resumeSession(params, requestId);
      case "session.pause":
        return this.pauseSession(params);
      case "session.stop":
        return this.stopSession(params);
      case "session.cancel":
        return this.cancelSession(params);
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
        return this.listTools(params);
      case "tools.register":
        return this.registerTool(params);
      case "tools.unregister":
        return this.unregisterTool(params);
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
      case "mcp.add":
        return this.mcpAdd(params);
      case "mcp.remove":
        return this.mcpRemove(params);
      case "mcp.start":
        return this.mcpStart(params);
      case "mcp.stop":
        return this.mcpStop(params);
      case "mcp.list":
        return this.mcpList(params);
      case "config.get":
        return this.configGet(params);
      case "config.set":
        return this.configSet(params);
      case "config.list":
        return this.configList(params);
      case "hooks.add":
        return this.hooksAdd(params);
      case "hooks.remove":
        return this.hooksRemove(params);
      case "hooks.list":
        return this.hooksList(params);
      case "context.read":
        return this.contextRead(params);
      case "context.write":
        return this.contextWrite(params);
      case "context.list":
        return this.contextList(params);
      case "session.branch":
        return this.branchSession(params, requestId);
      case "session.search":
        return this.searchSessions(params);
      case "session.export":
        return this.exportSession(params);
      case "session.delete":
        return this.deleteSession(params);
      case "session.cleanup":
        return this.cleanupSessions(params);
      case "webhook.subscribe":
        return this.webhookSubscribe(params);
      case "webhook.unsubscribe":
        return this.webhookUnsubscribe(params);
      case "template.create":
        return this.templateCreate(params);
      case "template.get":
        return this.templateGet(params);
      case "template.list":
        return this.templateList();
      case "template.delete":
        return this.templateDelete(params);
      case "audit.query":
        return this.auditQuery(params);
      case "provider.register":
        return this.providerRegister(params);
      case "provider.list":
        return this.providerList();
      case "provider.get":
        return this.providerGet(params);
      case "provider.update":
        return this.providerUpdate(params);
      case "provider.remove":
        return this.providerRemove(params);
      case "provider.setDefault":
        return this.providerSetDefault(params);
      case "provider.getDefault":
        return this.providerGetDefault();
      case "provider.healthCheck":
        return this.providerHealthCheck(params);
      case "provider.getFallbackChain":
        return this.providerGetFallbackChain(params);
      case "provider.switch":
        return this.providerSwitch(params);
      case "session.setProvider":
        return this.sessionSetProvider(params);
      case "token.getUsage":
        return this.tokenGetUsage(params);
      case "token.getSessionSummary":
        return this.tokenGetSessionSummary(params);
      case "token.getMessageUsage":
        return this.tokenGetMessageUsage(params);
      case "token.getProviderUsage":
        return this.tokenGetProviderUsage(params);
      case "token.clearAll":
        return this.tokenClearAll(params);
      case "token.registerCounter":
        return this.tokenRegisterCounter(params);
      case "token.listCounters":
        return this.tokenListCounters();
      case "quota.set":
        return this.quotaSet(params);
      case "quota.get":
        return this.quotaGet(params);
      case "quota.list":
        return this.quotaList(params);
      case "quota.remove":
        return this.quotaRemove(params);
      case "quota.clear":
        return this.quotaClear();
      case "quota.getStatus":
        return this.quotaGetStatus(params);
      case "quota.getViolations":
        return this.quotaGetViolations(params);
      case "balancer.create":
        return this.balancerCreate(params);
      case "balancer.remove":
        return this.balancerRemove(params);
      case "balancer.list":
        return this.balancerList();
      case "balancer.status":
        return this.balancerStatus(params);
      default:
        throw new BridgeError(METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
  }

  private emit(method: string, params: Record<string, unknown>, requestId: unknown = null): void {
    const payload = { ...params, requestId };
    const notification = { jsonrpc: "2.0" as const, method, params: payload };
    this.notify(notification);
    this.webhookManager.notify(notification);

    if (
      (method === "bridge/session_event" || method === "bridge/subagent_event") &&
      typeof params["sessionId"] === "string"
    ) {
      const sid = params["sessionId"] as string;
      const seq = this.eventSeq.get(sid) ?? 0;
      this.eventSeq.set(sid, seq + 1);

      const buf = this.eventLog.get(sid) ?? [];
      buf.push({ seq, payload });
      if (buf.length > EVENT_BUFFER_CAP) buf.shift();
      this.eventLog.set(sid, buf);
    }

    if (method === "bridge/session_event") {
      this.emitSubagentEvent(params, requestId);
    }
  }

  private emitSubagentEvent(params: Record<string, unknown>, requestId: unknown): void {
    const childSessionId = params["sessionId"];
    if (typeof childSessionId !== "string") {
      return;
    }

    const childSession = this.sessionStore.get(childSessionId);
    if (!childSession?.parentSessionId) {
      return;
    }

    const eventType = params["type"];
    if (
      eventType !== "agent_message" &&
      eventType !== "session_completed" &&
      eventType !== "session_stopped"
    ) {
      return;
    }

    this.emit(
      "bridge/subagent_event",
      {
        sessionId: childSession.parentSessionId,
        subagentId: childSessionId,
        type: eventType,
        ...(typeof params["messageType"] === "string" ? { messageType: params["messageType"] } : {}),
        ...(params["message"] !== undefined ? { message: params["message"] } : {}),
        ...(params["result"] !== undefined ? { result: params["result"] } : {}),
        ...(params["usage"] !== undefined ? { usage: params["usage"] } : {}),
        ...(
          eventType === "session_completed" || eventType === "session_stopped"
            ? { status: childSession.status }
            : {}
        ),
      },
      requestId,
    );
  }

  private async startSession(
    params: Record<string, unknown>,
    requestId: unknown,
  ): Promise<unknown> {
    const { workspace, prompt, options = {}, proxy, template, balancerId } = params;
    const { model, allowedTools, disallowedTools, permissionMode, maxTurns, systemPrompt, stream, timeoutMs } = params;

    if (!workspace || typeof workspace !== "string") {
      throw new BridgeError(-32602, "'workspace' must be provided");
    }

    if (!prompt || typeof prompt !== "string") {
      throw new BridgeError(-32602, "'prompt' must be provided");
    }

    if (stream !== undefined && typeof stream !== "boolean") {
      throw new BridgeError(-32602, "'stream' must be a boolean");
    }

    if (timeoutMs !== undefined && (typeof timeoutMs !== "number" || !Number.isInteger(timeoutMs) || timeoutMs < 1)) {
      throw new BridgeError(-32602, "'timeoutMs' must be a positive integer");
    }

    if (template !== undefined && typeof template !== "string") {
      throw new BridgeError(-32602, "'template' must be a string");
    }

    const typedOptions = options as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(typedOptions, "cwd")) {
      throw new BridgeError(
        -32602,
        "'cwd' must not be set in options; it is bridge-managed via 'workspace'",
      );
    }

    // Load template if specified
    let templateParams: Partial<AgentControlParams> = {};
    if (template) {
      const tmpl = this.templateStore.get(template);
      if (!tmpl) {
        throw new BridgeError(TEMPLATE_NOT_FOUND, `Template not found: ${template}`);
      }
      templateParams = {
        model: tmpl.model,
        allowedTools: tmpl.allowedTools,
        disallowedTools: tmpl.disallowedTools,
        permissionMode: tmpl.permissionMode,
        maxTurns: tmpl.maxTurns,
        systemPrompt: tmpl.systemPrompt,
      };
    }

    // Merge template params with explicit params (explicit takes precedence)
    const mergedParams = {
      ...templateParams,
      ...(model !== undefined && { model }),
      ...(allowedTools !== undefined && { allowedTools }),
      ...(disallowedTools !== undefined && { disallowedTools }),
      ...(permissionMode !== undefined && { permissionMode }),
      ...(maxTurns !== undefined && { maxTurns }),
      ...(systemPrompt !== undefined && { systemPrompt }),
    };

    const controlParams = validateAgentControlParams(mergedParams);

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

    const session = this.sessionStore.create(resolvedWorkspace, prompt, stream === true);

    if (balancerId !== undefined) {
      if (typeof balancerId !== "string") {
        throw new BridgeError(-32602, "'balancerId' must be a string");
      }
      try {
        balancerRegistry.get(balancerId as string);
      } catch {
        throw new BridgeError(-32001, `Balancer not found: ${balancerId}`);
      }
      this.sessionStore.updateActiveBalancerId(session.id, balancerId as string);
    }

    if (timeoutMs !== undefined) {
      session.timeoutMs = timeoutMs;
      this.sessionStore.persist(session);
    }

    this.auditLog.write(
      this.auditLog.createEntry(session.id, "session_started", "lifecycle", {
        workspace: resolvedWorkspace,
        model: controlParams.model ?? undefined,
        permissionMode: controlParams.permissionMode ?? undefined,
        timeoutMs: session.timeoutMs,
      }, { workspace: resolvedWorkspace }),
    );

    // Collect custom tools for this workspace
    const customTools = this._getAvailableCustomTools(resolvedWorkspace, controlParams.allowedTools, controlParams.disallowedTools);

    this.emit(
      "bridge/session_event",
      { sessionId: session.id, type: "session_started" },
      requestId,
    );

    this.sessionStore.transitionExecutionState(session.id, "running", "query_started");

    return this._runQuery(
      session,
      prompt,
      { ...passthroughOptions, ...buildControlOptions(controlParams) },
      { cwd: resolvedWorkspace, env: resolvedEnv },
      requestId,
      customTools,
    );
  }

  private async spawnSession(
    params: Record<string, unknown>,
    requestId: unknown,
  ): Promise<unknown> {
    const { parentSessionId, prompt, options = {}, proxy, workspace } = params;
    const { model, allowedTools, disallowedTools, permissionMode, maxTurns, systemPrompt, stream } = params;

    if (!parentSessionId || typeof parentSessionId !== "string") {
      throw new BridgeError(-32602, "'parentSessionId' must be provided");
    }

    const parentSession = this.sessionStore.get(parentSessionId);
    if (!parentSession) {
      throw new BridgeError(-32011, "Session not found", { sessionId: parentSessionId });
    }

    if (!prompt || typeof prompt !== "string") {
      throw new BridgeError(-32602, "'prompt' must be provided");
    }

    if (stream !== undefined && typeof stream !== "boolean") {
      throw new BridgeError(-32602, "'stream' must be a boolean");
    }

    if (workspace !== undefined) {
      if (typeof workspace !== "string") {
        throw new BridgeError(-32602, "'workspace' must be a string when provided");
      }

      const resolvedWorkspace = path.resolve(workspace);
      if (resolvedWorkspace !== parentSession.workspace) {
        throw new BridgeError(
          -32602,
          "'workspace' must match the parent session workspace when spawning",
        );
      }
    }

    const typedOptions = options as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(typedOptions, "cwd")) {
      throw new BridgeError(
        -32602,
        "'cwd' must not be set in options; it is bridge-managed via the parent session workspace",
      );
    }

    const controlParams = validateAgentControlParams({
      model,
      allowedTools,
      disallowedTools,
      permissionMode,
      maxTurns,
      systemPrompt,
    });

    const proxyParams = validateProxy(proxy);
    const proxyEnv = buildProxyEnv(proxyParams);
    const { env: callerEnv, ...passthroughOptions } = typedOptions;
    const resolvedEnv = mergeEnv(
      callerEnv as Record<string, string | undefined> | undefined,
      proxyEnv,
    );

    const session = this.sessionStore.create(
      parentSession.workspace,
      prompt,
      stream === true,
      parentSessionId,
    );

    this.auditLog.write(
      this.auditLog.createEntry(session.id, "session_spawned", "lifecycle", {
        workspace: parentSession.workspace,
        parentSessionId,
      }, { workspace: parentSession.workspace, parentSessionId }),
    );

    const customTools = this._getAvailableCustomTools(
      parentSession.workspace,
      controlParams.allowedTools,
      controlParams.disallowedTools,
    );

    this.emit(
      "bridge/session_event",
      { sessionId: session.id, type: "session_started" },
      requestId,
    );

    this.sessionStore.transitionExecutionState(session.id, "running", "query_started");

    return this._runQuery(
      session,
      prompt,
      { ...passthroughOptions, ...buildControlOptions(controlParams) },
      { cwd: parentSession.workspace, env: resolvedEnv },
      requestId,
      customTools,
    );
  }

  private async resumeSession(
    params: Record<string, unknown>,
    requestId: unknown,
  ): Promise<unknown> {
    const { sessionId, prompt, options = {}, proxy } = params;
    const { model, allowedTools, disallowedTools, permissionMode, maxTurns, systemPrompt, stream, timeoutMs } = params;

    if (!sessionId || typeof sessionId !== "string") {
      throw new BridgeError(-32602, "'sessionId' must be provided");
    }

    const session = this.sessionStore.get(sessionId);
    if (!session) {
      throw new BridgeError(-32011, "Session not found", { sessionId });
    }

    if (session.executionState !== "paused") {
      if (!prompt || typeof prompt !== "string") {
        throw new BridgeError(-32602, "'prompt' must be provided");
      }
    }

    if (stream !== undefined && typeof stream !== "boolean") {
      throw new BridgeError(-32602, "'stream' must be a boolean");
    }

    if (timeoutMs !== undefined && (typeof timeoutMs !== "number" || !Number.isInteger(timeoutMs) || timeoutMs < 1)) {
      throw new BridgeError(-32602, "'timeoutMs' must be a positive integer");
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

    // Update stream flag if specified, otherwise keep existing value
    if (stream === true) {
      session.stream = true;
    }

    if (timeoutMs !== undefined) {
      session.timeoutMs = timeoutMs;
      this.sessionStore.persist(session);
    }

    const proxyParams = validateProxy(proxy);
    const proxyEnv = buildProxyEnv(proxyParams);
    const { env: callerEnv, ...passthroughOptions } = typedOptions;
    const resolvedEnv = mergeEnv(
      callerEnv as Record<string, string | undefined> | undefined,
      proxyEnv,
    );

    if (session.executionState === "paused") {
      const ok = this.sessionStore.transitionExecutionState(sessionId, "running", "user_resume");
      if (!ok) {
        throw new BridgeError(-32602, "State transition failed");
      }

      session.pausedAt = undefined;
      session.pauseReason = undefined;

      this.auditLog.write(
        this.auditLog.createEntry(sessionId, "session_resumed", "lifecycle", {
          workspace: session.workspace,
        }, { workspace: session.workspace }),
      );

      this.emit(
        "bridge/session_event",
        { sessionId: session.id, type: "session_resumed" },
        requestId,
      );

      void this._fireHooks("notification", sessionId, session.workspace);

      return { sessionId: session.id, status: "resumed" };
    } else {
      const safePrompt = typeof prompt === "string" ? prompt : undefined;
      this.sessionStore.appendEvent(session.id, { type: "resume_prompt", prompt: safePrompt });

      this.auditLog.write(
        this.auditLog.createEntry(sessionId, "session_resumed", "lifecycle", {
          workspace: session.workspace,
        }, { workspace: session.workspace }),
      );

      // Collect custom tools for this workspace
      const customTools = this._getAvailableCustomTools(session.workspace, controlParams.allowedTools, controlParams.disallowedTools);

      this.emit(
        "bridge/session_event",
        { sessionId: session.id, type: "session_resumed" },
        requestId,
      );

      this.sessionStore.transitionExecutionState(session.id, "running", "query_started");

      session.status = "active";
      session.stopRequested = false;
      this.sessionStore.persist(session);

      const queryPrompt = typeof prompt === "string" ? prompt : "";
      return this._runQuery(
        session,
        queryPrompt,
        { ...passthroughOptions, resume: session.sdkSessionId, ...buildControlOptions(controlParams) },
        { cwd: session.workspace, env: resolvedEnv },
        requestId,
        customTools,
      );
    }
  }

  private async _runQuery(
    session: { id: string; stream?: boolean },
    prompt: string,
    options: Record<string, unknown>,
    context: AgentQueryContext,
    requestId: unknown,
    customTools: CustomTool[] = [],
  ): Promise<unknown> {
    let resolvedOptions = options;
    if (options["permissionMode"] === "approve") {
      resolvedOptions = {
        ...options,
        permissionMode: "default",
        canUseTool: this._buildApprovalCallback(session.id),
      };
    }

    const isStreaming = Boolean(session.stream);

    if (isStreaming) {
      resolvedOptions = { ...resolvedOptions, includePartialMessages: true };
    }

    // Inject custom tools into system prompt if available
    if (customTools.length > 0) {
      const customToolInstructions = this._buildCustomToolInstructions(customTools);
      const existingSystemPrompt = resolvedOptions["systemPrompt"] as string | undefined;
      resolvedOptions = {
        ...resolvedOptions,
        systemPrompt: existingSystemPrompt
          ? `${existingSystemPrompt}\n\n${customToolInstructions}`
          : customToolInstructions,
      };
    }

    // Track per-turn chunk index for streaming
    let streamChunkIndex = 0;

    const abortController = new AbortController();
    this.abortControllers.set(session.id, abortController);

    // Setup timeout if needed
    const fullSession = this.sessionStore.get(session.id);
    if (fullSession && fullSession.timeoutMs !== undefined) {
      const timeoutId = setTimeout(() => {
        this.cancelSession({ sessionId: session.id, reason: "timeout" });
      }, fullSession.timeoutMs);
      this.timeoutIds.set(session.id, timeoutId);
    }

    try {
      const onEvent = (message: unknown): void => {
        const current = this.sessionStore.get(session.id);
        if (current?.stopRequested) {
          return;
        }

        // Transition to waiting_for_input when tool approval is needed
        if (
          message !== null &&
          typeof message === "object" &&
          (message as Record<string, unknown>)["type"] === "assistant"
        ) {
          const innerMsg = (message as Record<string, unknown>)["message"] as Record<string, unknown> | undefined;
          const content = innerMsg?.["content"] ?? (message as Record<string, unknown>)["content"];
          if (Array.isArray(content)) {
            const blocks = content as Array<Record<string, unknown>>;
            if (blocks.some((b) => b["type"] === "tool_use")) {
              this.sessionStore.transitionExecutionState(session.id, "waiting_for_input", "tool_approval_needed");
            }
          }
        }

        // Handle streaming partial messages (SDKPartialAssistantMessage with content_block_delta)
        if (isStreaming && isStreamEvent(message)) {
          const textDelta = extractTextDelta(message);
          if (textDelta !== null) {
            this.sessionStore.appendEvent(session.id, {
              type: "stream_chunk",
              message: { content: textDelta, index: streamChunkIndex },
            });

            this.emit(
              "bridge/session_event",
              {
                sessionId: session.id,
                type: "agent_message",
                messageType: "stream_chunk",
                content: textDelta,
                index: streamChunkIndex,
              },
              requestId,
            );

            streamChunkIndex++;
          }
          return; // Don't emit agent_message for partial events
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

        const msgType = classifyMessageType(message);

        // Reset chunk index when a complete assistant message arrives (new turn)
        if (msgType === "assistant_text" || msgType === "tool_use") {
          streamChunkIndex = 0;
        }

        this.emit(
          "bridge/session_event",
          { sessionId: session.id, type: "agent_message", messageType: msgType, message },
          requestId,
        );

        // Fire hooks based on message type
        if (msgType === "tool_use") {
          const toolName = this._extractToolName(message);
          const toolInput = this._extractToolInput(message);
          const toolId = this._extractToolUseId(message);
          const inputHash = toolInput ? crypto.createHash("sha256").update(JSON.stringify(toolInput)).digest("hex") : undefined;
          this.auditLog.write(
            this.auditLog.createEntry(session.id, "tool_use", "execution", {
              toolName: toolName ?? "unknown",
              inputHash: inputHash ?? "",
              id: toolId ?? "",
            }, { workspace: context.cwd }),
          );
          // Blocking hooks execute asynchronously; if they fail, stop the session
          this._fireHooks("pre_tool_use", session.id, context.cwd, toolName).then((passed) => {
            if (!passed) {
              this.sessionStore.stop(session.id);
            }
          });

          // File change tracking for Write/Edit tools
          this._emitFileChange(session.id, toolName, message, context.cwd);
        } else if (msgType === "tool_result") {
          const toolName = this._extractToolNameFromResult(message);
          this.auditLog.write(
            this.auditLog.createEntry(session.id, "tool_result", "execution", {
              toolName: toolName ?? "unknown",
              inputHash: "",
              status: "success",
            }, { workspace: context.cwd }),
          );
          this.sessionStore.transitionExecutionState(session.id, "running", "tool_result_received");
          void this._fireHooks("post_tool_use", session.id, context.cwd);
        }

        void this._fireHooks("notification", session.id, context.cwd);
      };

      const sharedQueryOptions = {
        prompt,
        options: resolvedOptions,
        cwd: context.cwd,
        env: context.env,
        shouldStop: () => {
          const current = this.sessionStore.get(session.id);
          return Boolean(current?.stopRequested);
        },
        signal: abortController.signal,
        onEvent,
        onQuotaWarning: (warning: QuotaWarning) => {
          this.emit("bridge/quota_warning", {
            quotaId: warning.quotaId,
            scope: warning.scope,
            scopeId: warning.scopeId ?? null,
            limit: warning.limit,
            currentUsage: warning.currentUsage,
            percentage: warning.percentage,
            sessionId: warning.sessionId,
          }, requestId);
        },
        onQuotaBlocked: (notification: QuotaBlockedNotification) => {
          this.emit("bridge/quota_blocked", notification as unknown as Record<string, unknown>, requestId);
        },
      };

      // Build ordered candidate list for reactive fallback
      const sessionInfo = this.sessionStore.get(session.id);
      const activeBalancerId = sessionInfo?.activeBalancerId;
      let queryResult: ClaudeQueryResult;

      if (activeBalancerId) {
        // Balancer-routed: ask the balancer for the next provider, then follow its fallback chain
        let selectedProviderId: string;
        try {
          selectedProviderId = balancerRegistry.route(activeBalancerId);
        } catch (err) {
          if (err instanceof Error && (err as Error & { code?: string }).code === "ALL_EXCLUDED") {
            throw new BridgeError(BALANCER_ALL_EXCLUDED, "No healthy providers available in balancer");
          }
          throw err;
        }

        // Build candidate list: selected provider + its fallback chain
        let fallbackChain: string[] = [];
        try {
          fallbackChain = providerRegistry.getFallbackChain(selectedProviderId);
        } catch {
          // provider may not expose a chain
        }
        const balancerCandidates = [selectedProviderId, ...fallbackChain];

        let lastError: unknown = null;
        let resolved: ClaudeQueryResult | undefined;
        let fromProviderId: string | null = null;
        let primaryFailed = false;

        for (const candidateId of balancerCandidates) {
          if (fromProviderId !== null) {
            this.emit("bridge/provider_fallback_activated", {
              fromProviderId,
              toProviderId: candidateId,
              reason: lastError instanceof Error ? lastError.message : String(lastError),
              sessionId: session.id,
            }, requestId);
          }

          try {
            streamChunkIndex = 0;
            const provider = await providerRegistry.resolveCandidate(candidateId);
            resolved = await runClaudeQuery({ ...sharedQueryOptions, provider });
            break;
          } catch (err) {
            lastError = err;
            if (candidateId === selectedProviderId) {
              primaryFailed = true;
              // Reactively exclude the balancer-selected provider
              balancerRegistry.excludeProvider(
                activeBalancerId,
                selectedProviderId,
                err instanceof Error ? err.message : String(err),
              );
            }
            fromProviderId = candidateId;
          }
        }

        if (!primaryFailed && resolved === undefined) {
          // The selected provider was never tried (shouldn't happen) — exclude and throw
          balancerRegistry.excludeProvider(activeBalancerId, selectedProviderId, "provider unavailable");
        }

        if (resolved === undefined) {
          throw lastError;
        }
        queryResult = resolved;
      } else {
        const candidateIds = providerRegistry.getSessionCandidateIds(session.id);

        if (candidateIds.length === 0) {
          // No registered providers configured — use existing health-check-based resolution
          const resolvedProvider = await providerRegistry.resolveForSession(session.id);
          queryResult = await runClaudeQuery({ ...sharedQueryOptions, provider: resolvedProvider });
        } else {
          // Walk candidate list reactively: try each provider, fall back on error
          let lastError: unknown = null;
          let resolved: ClaudeQueryResult | undefined;
          let fromProviderId: string | null = null;

          for (const candidateId of candidateIds) {
            if (fromProviderId !== null) {
              this.emit("bridge/provider_fallback_activated", {
                fromProviderId,
                toProviderId: candidateId,
                reason: lastError instanceof Error ? lastError.message : String(lastError),
                sessionId: session.id,
              }, requestId);
            }

            try {
              streamChunkIndex = 0;
              const provider = await providerRegistry.resolveCandidate(candidateId);
              resolved = await runClaudeQuery({ ...sharedQueryOptions, provider });
              break;
            } catch (err) {
              lastError = err;
              fromProviderId = candidateId;
            }
          }

          if (resolved === undefined) {
            throw lastError;
          }
          queryResult = resolved;
        }
      }

      const currentSession = this.sessionStore.get(session.id);
      if (currentSession?.cancelledAt) {
        const cancelledAt = currentSession.cancelledAt;
        const cancelReason = currentSession.cancelReason;
        this.emit(
          "bridge/session_event",
          {
            sessionId: session.id,
            type: "session_completed",
            cancelledAt,
            cancelReason,
            result: null,
            usage: null,
          },
          requestId,
        );

        return {
          sessionId: session.id,
          status: "completed",
          cancelledAt,
          cancelReason,
          result: null,
          usage: null,
        };
      }

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
    } finally {
      this.abortControllers.delete(session.id);
      const timeoutId = this.timeoutIds.get(session.id);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.timeoutIds.delete(session.id);
      }
    }
  }

  private stopSession(params: Record<string, unknown>): unknown {
    const { sessionId } = params;
    if (!sessionId || typeof sessionId !== "string") {
      throw new BridgeError(-32602, "'sessionId' must be provided");
    }

    const cascadedSessionIds = this.sessionStore
      .getActiveDescendants(sessionId)
      .map((session) => session.id);
    const session = this.sessionStore.stop(sessionId);
    if (!session) {
      throw new BridgeError(-32011, "Session not found", { sessionId });
    }

    this.auditLog.write(
      this.auditLog.createEntry(sessionId, "session_stopped", "lifecycle", {
        status: session.status,
        workspace: session.workspace,
      }, { workspace: session.workspace }),
    );

    for (const [reqId, pending] of this.pendingApprovals) {
      if (pending.sessionId === sessionId) {
        this.pendingApprovals.delete(reqId);
        pending.resolve({ behavior: "deny", message: "Session stopped" });
      }
    }

    void this._fireHooks("stop", sessionId, session.workspace);
    for (const childSessionId of cascadedSessionIds) {
      const childSession = this.sessionStore.get(childSessionId);
      if (childSession) {
        void this._fireHooks("subagent_stop", childSessionId, childSession.workspace);
      }
    }

    return { sessionId, status: session.status };
  }

  private pauseSession(params: Record<string, unknown>): unknown {
    const { sessionId, reason } = params;
    if (!sessionId || typeof sessionId !== "string") {
      throw new BridgeError(-32602, "'sessionId' must be provided");
    }
    if (reason !== undefined && typeof reason !== "string") {
      throw new BridgeError(-32602, "'reason' must be a string if provided");
    }

    const session = this.sessionStore.get(sessionId);
    if (!session) {
      throw new BridgeError(-32011, "Session not found", { sessionId });
    }

    if (session.executionState !== "running" && session.executionState !== "waiting_for_input") {
      throw new BridgeError(-32602, `Cannot pause session in state: ${session.executionState}. Can only pause from "running" or "waiting_for_input".`);
    }

    const pausedAt = new Date().toISOString();
    const ok = this.sessionStore.transitionExecutionState(sessionId, "paused", "user_pause");
    if (!ok) {
      throw new BridgeError(-32602, "State transition failed");
    }

    session.pausedAt = pausedAt;
    if (reason !== undefined) {
      session.pauseReason = reason;
    }

    this.auditLog.write(
      this.auditLog.createEntry(sessionId, "session_paused", "lifecycle", {
        reason: reason ?? undefined,
        pausedAt,
      }, { workspace: session.workspace }),
    );

    void this._fireHooks("notification", sessionId, session.workspace);

    return { success: true, sessionId, pausedAt };
  }

  private cancelSession(params: Record<string, unknown>): unknown {
    const { sessionId, reason } = params;

    if (!sessionId || typeof sessionId !== "string") {
      throw new BridgeError(-32602, "'sessionId' must be provided");
    }

    if (reason !== undefined && typeof reason !== "string") {
      throw new BridgeError(-32602, "'reason' must be a string");
    }

    const session = this.sessionStore.get(sessionId);
    if (!session) {
      throw new BridgeError(-32011, "Session not found", { sessionId });
    }

    if (session.status !== "active") {
      throw new BridgeError(-32602, "Session is not active", { sessionId });
    }

    const cancelledAt = new Date().toISOString();
    const cancelReason = reason ?? "user_requested";
    const ok = this.sessionStore.transitionExecutionState(sessionId, "completed", "cancelled");
    if (!ok) {
      throw new BridgeError(-32602, "State transition failed");
    }

    this.sessionStore.cancelSession(sessionId, cancelReason);

    const abortController = this.abortControllers.get(sessionId);
    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(sessionId);
    }

    const timeoutId = this.timeoutIds.get(sessionId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeoutIds.delete(sessionId);
    }

    this.auditLog.write(
      this.auditLog.createEntry(sessionId, "session_cancelled", "lifecycle", {
        reason: cancelReason,
        cancelledAt,
      }, { workspace: session.workspace }),
    );

    void this._fireHooks("notification", sessionId, session.workspace);

    return { success: true, sessionId, cancelledAt, cancelReason };
  }

  private auditQuery(params: Record<string, unknown>): unknown {
    const { sessionId, category, eventType, since, until, limit } = params;

    const filters: Record<string, unknown> = {};
    if (sessionId !== undefined) {
      if (typeof sessionId !== "string") {
        throw new BridgeError(-32602, "'sessionId' must be a string");
      }
      filters.sessionId = sessionId;
    }
    if (category !== undefined) {
      if (typeof category !== "string") {
        throw new BridgeError(-32602, "'category' must be a string");
      }
      filters.category = category;
    }
    if (eventType !== undefined) {
      if (typeof eventType !== "string") {
        throw new BridgeError(-32602, "'eventType' must be a string");
      }
      filters.eventType = eventType;
    }
    if (since !== undefined) {
      if (typeof since !== "string") {
        throw new BridgeError(-32602, "'since' must be an ISO-8601 timestamp string");
      }
      filters.since = since;
    }
    if (until !== undefined) {
      if (typeof until !== "string") {
        throw new BridgeError(-32602, "'until' must be an ISO-8601 timestamp string");
      }
      filters.until = until;
    }
    if (limit !== undefined) {
      if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1) {
        throw new BridgeError(-32602, "'limit' must be a positive integer");
      }
      filters.limit = Math.min(limit, 500);
    }

    return this.auditLog.query(filters as import("./audit-log.js").AuditQueryFilters);
  }

  private providerRegister(params: Record<string, unknown>): unknown {
    if (!params || typeof params !== "object" || Array.isArray(params)) {
      throw new BridgeError(-32602, "params must be an object with provider configuration");
    }

    try {
      const result = providerRegistry.register(params as import("./llm-provider/types.js").ProviderConfig);
      return result;
    } catch (error) {
      if (error instanceof Error && error.name === "ProviderRegistryError") {
        const err = error as Error & { code?: string };
        switch (err.code) {
          case "VALIDATION_ERROR":
            throw new BridgeError(-32602, err.message);
          case "DUPLICATE_ID":
            throw new BridgeError(-32002, err.message);
          case "UNSUPPORTED_TYPE":
            throw new BridgeError(-32003, err.message);
          default:
            throw new BridgeError(-32603, err.message);
        }
      }
      throw new BridgeError(-32603, `Failed to register provider: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private providerList(): unknown {
    return providerRegistry.list();
  }

  private providerGet(params: Record<string, unknown>): unknown {
    const { providerId } = params;
    if (!providerId || typeof providerId !== "string") {
      throw new BridgeError(-32602, "'providerId' must be a string");
    }

    try {
      return providerRegistry.get(providerId);
    } catch (error) {
      if (error instanceof Error && error.name === "ProviderRegistryError") {
        throw new BridgeError(-32001, error.message);
      }
      throw new BridgeError(-32603, `Failed to get provider: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private providerUpdate(params: Record<string, unknown>): unknown {
    const { providerId, config } = params;
    if (!providerId || typeof providerId !== "string") {
      throw new BridgeError(-32602, "'providerId' must be a string");
    }
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new BridgeError(-32602, "'config' must be an object");
    }

    try {
      return providerRegistry.update(providerId, config as Partial<import("./llm-provider/types.js").ProviderConfig>);
    } catch (error) {
      if (error instanceof Error && error.name === "ProviderRegistryError") {
        const err = error as Error & { code?: string };
        switch (err.code) {
          case "NOT_FOUND":
            throw new BridgeError(-32001, err.message);
          case "VALIDATION_ERROR":
            throw new BridgeError(-32602, err.message);
          default:
            throw new BridgeError(-32603, err.message);
        }
      }
      throw new BridgeError(-32603, `Failed to update provider: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private providerRemove(params: Record<string, unknown>): unknown {
    const { providerId } = params;
    if (!providerId || typeof providerId !== "string") {
      throw new BridgeError(-32602, "'providerId' must be a string");
    }

    try {
      return providerRegistry.remove(providerId);
    } catch (error) {
      if (error instanceof Error && error.name === "ProviderRegistryError") {
        throw new BridgeError(-32001, error.message);
      }
      throw new BridgeError(-32603, `Failed to remove provider: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private providerSetDefault(params: Record<string, unknown>): unknown {
    const { providerId } = params;
    if (!providerId || typeof providerId !== "string") {
      throw new BridgeError(-32602, "'providerId' must be a string");
    }

    try {
      return providerRegistry.setDefault(providerId);
    } catch (error) {
      if (error instanceof Error && error.name === "ProviderRegistryError") {
        throw new BridgeError(-32001, error.message);
      }
      throw new BridgeError(-32603, `Failed to set default provider: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private providerGetDefault(): unknown {
    return providerRegistry.getDefault();
  }

  private providerGetFallbackChain(params: Record<string, unknown>): unknown {
    const { providerId } = params;
    if (!providerId || typeof providerId !== "string") {
      throw new BridgeError(-32602, "'providerId' must be a string");
    }

    try {
      const fallbackProviderIds = providerRegistry.getFallbackChain(providerId);
      return { providerId, fallbackProviderIds };
    } catch (error) {
      if (error instanceof Error && error.name === "ProviderRegistryError") {
        throw new BridgeError(-32001, error.message);
      }
      throw new BridgeError(-32603, `Failed to get fallback chain: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async providerHealthCheck(params: Record<string, unknown>): Promise<unknown> {
    const { providerId } = params;
    if (!providerId || typeof providerId !== "string") {
      throw new BridgeError(-32602, "'providerId' must be a string");
    }

    try {
      return await providerRegistry.healthCheck(providerId);
    } catch (error) {
      if (error instanceof Error && error.name === "ProviderRegistryError") {
        throw new BridgeError(-32001, error.message);
      }
      throw new BridgeError(-32603, `Failed to check provider health: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async providerSwitch(params: Record<string, unknown>): Promise<unknown> {
    const { sessionId, providerId } = params;
    if (!sessionId || typeof sessionId !== "string") {
      throw new BridgeError(-32602, "'sessionId' must be a string");
    }
    if (!providerId || typeof providerId !== "string") {
      throw new BridgeError(-32602, "'providerId' must be a string");
    }

    const session = this.sessionStore.get(sessionId);
    if (!session) {
      throw new BridgeError(-32011, "Session not found", { sessionId });
    }

    const switchableStates = new Set(["idle", "running", "paused", "waiting_for_input", "completed"]);
    if (!switchableStates.has(session.executionState)) {
      throw new BridgeError(-32602, `Cannot switch provider on session in state: ${session.executionState}`);
    }

    try {
      const result = await providerRegistry.switchSessionProvider(sessionId, providerId);
      this.sessionStore.updateActiveProviderId(sessionId, providerId);

      this.emit("bridge/provider_switched", {
        sessionId,
        previousProviderId: result.previousProviderId,
        newProviderId: result.newProviderId,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      if (error instanceof Error && error.name === "ProviderRegistryError") {
        const err = error as Error & { code?: string };
        if (err.code === "NOT_FOUND") {
          throw new BridgeError(-32001, error.message);
        }
        if (err.code === "UNHEALTHY") {
          throw new BridgeError(-32004, error.message);
        }
        throw new BridgeError(-32603, error.message);
      }
      throw new BridgeError(-32603, `Failed to switch provider: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async sessionSetProvider(params: Record<string, unknown>): Promise<unknown> {
    const { balancerId } = params;
    if (balancerId !== undefined) {
      if (typeof balancerId !== "string") {
        throw new BridgeError(-32602, "'balancerId' must be a string");
      }
      const { sessionId } = params;
      if (!sessionId || typeof sessionId !== "string") {
        throw new BridgeError(-32602, "'sessionId' must be a string");
      }
      const session = this.sessionStore.get(sessionId);
      if (!session) {
        throw new BridgeError(-32011, "Session not found", { sessionId });
      }
      try {
        balancerRegistry.get(balancerId); // validate exists
      } catch {
        throw new BridgeError(-32001, `Balancer not found: ${balancerId}`);
      }
      this.sessionStore.updateActiveBalancerId(sessionId, balancerId);
      this.sessionStore.updateActiveProviderId(sessionId, null);
      return { success: true, sessionId, balancerId };
    }
    return this.providerSwitch(params);
  }

  private tokenGetUsage(params: Record<string, unknown>): unknown {
    const { sessionId } = params;
    if (!sessionId || typeof sessionId !== "string") {
      throw new BridgeError(-32602, "'sessionId' must be provided");
    }
    const summary = getTokenStore().getSessionUsage(sessionId);
    if (!summary) {
      throw new BridgeError(-32051, "Session not found", { sessionId });
    }
    return summary;
  }

  private tokenGetSessionSummary(params: Record<string, unknown>): unknown {
    const { sessionId } = params;
    if (!sessionId || typeof sessionId !== "string") {
      throw new BridgeError(-32602, "'sessionId' must be provided");
    }
    const summary = getTokenStore().getSessionUsage(sessionId);
    if (!summary) {
      throw new BridgeError(-32051, "Session not found", { sessionId });
    }
    return summary;
  }

  private tokenGetMessageUsage(params: Record<string, unknown>): unknown {
    const { sessionId, messageId } = params;
    if (!sessionId || typeof sessionId !== "string") {
      throw new BridgeError(-32602, "'sessionId' must be provided");
    }
    if (!messageId || typeof messageId !== "string") {
      throw new BridgeError(-32602, "'messageId' must be provided");
    }
    const record = getTokenStore().getMessageUsage(sessionId, messageId);
    if (!record) {
      throw new BridgeError(-32052, "Message not found", { sessionId, messageId });
    }
    return record;
  }

  private tokenGetProviderUsage(params: Record<string, unknown>): unknown {
    const { providerId } = params;
    const filter = providerId !== undefined ? String(providerId) : undefined;
    return getTokenStore().getProviderUsage(filter);
  }

  private tokenClearAll(_params: Record<string, unknown>): unknown {
    const clearedCount = getTokenStore().clearAll();
    return { success: true, clearedCount };
  }

  private async tokenRegisterCounter(params: Record<string, unknown>): Promise<unknown> {
    const { providerType } = params;
    if (!providerType || typeof providerType !== "string") {
      throw new BridgeError(-32602, "'providerType' must be a non-empty string");
    }
    const description = typeof params["description"] === "string" ? params["description"] : undefined;
    const { PassthroughTokenCounter } = await import("./token-tracking/counters/anthropic.js");
    counterRegistry.register(new PassthroughTokenCounter(providerType), description);
    return { success: true, providerType };
  }

  private tokenListCounters(): unknown {
    return counterRegistry.list();
  }

  private quotaSet(params: Record<string, unknown>): unknown {
    const rule = validateQuotaRule(params);
    if (!rule) {
      throw new BridgeError(-32602, "Invalid quota rule parameters");
    }
    const registry = getQuotaRegistry();
    if (!registry.set(rule)) {
      throw new BridgeError(-32602, "Quota rule already exists", { quotaId: rule.quotaId });
    }
    return { success: true, quotaId: rule.quotaId };
  }

  private quotaGet(params: Record<string, unknown>): unknown {
    const { quotaId } = params;
    if (typeof quotaId !== "string" || !quotaId) {
      throw new BridgeError(-32602, "'quotaId' must be a non-empty string");
    }
    const registry = getQuotaRegistry();
    const rule = registry.get(quotaId);
    if (!rule) {
      throw new BridgeError(QUOTA_NOT_FOUND, "Quota rule not found", { quotaId });
    }
    return rule;
  }

  private quotaList(params: Record<string, unknown>): unknown {
    const { scope } = params;
    const registry = getQuotaRegistry();
    if (scope !== undefined && typeof scope === "string") {
      return registry.list(scope);
    }
    return registry.list();
  }

  private quotaRemove(params: Record<string, unknown>): unknown {
    const { quotaId } = params;
    if (typeof quotaId !== "string" || !quotaId) {
      throw new BridgeError(-32602, "'quotaId' must be a non-empty string");
    }
    const registry = getQuotaRegistry();
    if (!registry.remove(quotaId)) {
      throw new BridgeError(QUOTA_NOT_FOUND, "Quota rule not found", { quotaId });
    }
    return { success: true, quotaId };
  }

  private quotaClear(): unknown {
    const registry = getQuotaRegistry();
    const clearedCount = registry.clear();
    return { success: true, clearedCount };
  }

  private quotaGetStatus(params: Record<string, unknown>): unknown {
    const { scope, sessionId, providerId } = params;
    const registry = getQuotaRegistry();
    let rules = registry.list(typeof scope === "string" ? scope : undefined);
    if (rules.length === 0) return [];
    const sid = typeof sessionId === "string" ? sessionId : "";
    const pid = typeof providerId === "string" ? providerId : undefined;
    return buildQuotaStatuses(rules, sid, pid);
  }

  private quotaGetViolations(params: Record<string, unknown>): unknown {
    const { sessionId } = params;
    const registry = getQuotaRegistry();
    return registry.getViolations(typeof sessionId === "string" ? sessionId : undefined);
  }

  private balancerCreate(params: Record<string, unknown>): unknown {
    const { id, strategy, providerIds, weights, coolDownMs } = params;

    if (!id || typeof id !== "string") {
      throw new BridgeError(-32602, "'id' must be a non-empty string");
    }
    if (strategy !== "round-robin" && strategy !== "weighted") {
      throw new BridgeError(-32602, "'strategy' must be 'round-robin' or 'weighted'");
    }
    if (!Array.isArray(providerIds) || providerIds.length === 0) {
      throw new BridgeError(-32602, "'providerIds' must be a non-empty array");
    }
    if (!(providerIds as unknown[]).every((p) => typeof p === "string")) {
      throw new BridgeError(-32602, "'providerIds' must contain only strings");
    }
    if (weights !== undefined) {
      if (!Array.isArray(weights) || !(weights as unknown[]).every((w) => typeof w === "number")) {
        throw new BridgeError(-32602, "'weights' must be an array of numbers");
      }
    }
    if (coolDownMs !== undefined && (typeof coolDownMs !== "number" || !Number.isInteger(coolDownMs) || coolDownMs < 0)) {
      throw new BridgeError(-32602, "'coolDownMs' must be a non-negative integer");
    }

    // Sync known provider IDs so balancerRegistry can validate
    const knownIds = new Set(providerRegistry.list().map((p) => p.id));
    balancerRegistry.setKnownProviderIds(knownIds);

    const config: BalancerConfig = {
      id: id as string,
      strategy: strategy as "round-robin" | "weighted",
      providerIds: providerIds as string[],
      ...(weights !== undefined && { weights: weights as number[] }),
      ...(coolDownMs !== undefined && { coolDownMs: coolDownMs as number }),
    };

    try {
      return balancerRegistry.create(config);
    } catch (err) {
      if (err instanceof Error && err.name === "BalancerRegistryError") {
        const e = err as Error & { code?: string };
        switch (e.code) {
          case "DUPLICATE_ID": throw new BridgeError(-32002, err.message);
          case "PROVIDER_NOT_FOUND": throw new BridgeError(-32001, err.message);
          case "INVALID_PARAMS": throw new BridgeError(-32602, err.message);
          default: throw new BridgeError(-32603, err.message);
        }
      }
      throw new BridgeError(-32603, `Failed to create balancer: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private balancerRemove(params: Record<string, unknown>): unknown {
    const { balancerId } = params;
    if (!balancerId || typeof balancerId !== "string") {
      throw new BridgeError(-32602, "'balancerId' must be a string");
    }

    try {
      return balancerRegistry.remove(balancerId);
    } catch (err) {
      if (err instanceof Error && err.name === "BalancerRegistryError") {
        throw new BridgeError(-32001, err.message);
      }
      throw new BridgeError(-32603, `Failed to remove balancer: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private balancerList(): unknown {
    return balancerRegistry.list();
  }

  private balancerStatus(params: Record<string, unknown>): unknown {
    const { balancerId } = params;
    if (!balancerId || typeof balancerId !== "string") {
      throw new BridgeError(-32602, "'balancerId' must be a string");
    }

    try {
      return balancerRegistry.status(balancerId);
    } catch (err) {
      if (err instanceof Error && err.name === "BalancerRegistryError") {
        throw new BridgeError(-32001, err.message);
      }
      throw new BridgeError(-32603, `Failed to get balancer status: ${err instanceof Error ? err.message : String(err)}`);
    }
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
      parentSessionId: session.parentSessionId ?? null,
      status: session.status,
      executionState: session.executionState,
      activeProviderId: session.activeProviderId ?? null,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      historyLength: session.history.length,
      result: session.result,
      pausedAt: session.pausedAt ?? null,
      pauseReason: session.pauseReason ?? null,
      cancelledAt: session.cancelledAt ?? null,
      cancelReason: session.cancelReason ?? null,
      timeoutMs: session.timeoutMs ?? null,
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
    const { status, parentSessionId } = params;

    if (status !== undefined && status !== "active" && status !== "all") {
      throw new BridgeError(-32602, "'status' must be 'active' or 'all'");
    }

    if (parentSessionId !== undefined && typeof parentSessionId !== "string") {
      throw new BridgeError(-32602, "'parentSessionId' must be a string");
    }

    const sessions = this.sessionStore.list({
      status: status as "active" | "all" | undefined,
      ...(typeof parentSessionId === "string" ? { parentSessionId } : {}),
    });

    return {
      sessions: sessions.map((s) => {
        const firstPromptEntry = s.history.find((e) => e.type === "user_prompt");
        const prompt = firstPromptEntry?.prompt
          ? firstPromptEntry.prompt.slice(0, 200)
          : null;
        return {
          sessionId: s.id,
          status: s.status,
          executionState: s.executionState,
          workspace: s.workspace,
          parentSessionId: s.parentSessionId ?? null,
          activeProviderId: s.activeProviderId ?? null,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          prompt,
          pausedAt: s.pausedAt ?? null,
          pauseReason: s.pauseReason ?? null,
          cancelledAt: s.cancelledAt ?? null,
          cancelReason: s.cancelReason ?? null,
          timeoutMs: s.timeoutMs ?? null,
        };
      }),
    };
  }

  // --- Hook helpers ---

  private _extractToolName(message: unknown): string | undefined {
    if (message === null || typeof message !== "object") return undefined;
    const msg = message as Record<string, unknown>;
    const innerMsg = msg["message"] as Record<string, unknown> | undefined;
    const content = innerMsg?.["content"] ?? msg["content"];
    if (!Array.isArray(content)) return undefined;
    for (const block of content as Array<Record<string, unknown>>) {
      if (block["type"] === "tool_use" && typeof block["name"] === "string") {
        return block["name"];
      }
    }
    return undefined;
  }

  private _extractToolInput(message: unknown): Record<string, unknown> | undefined {
    if (message === null || typeof message !== "object") return undefined;
    const msg = message as Record<string, unknown>;
    const innerMsg = msg["message"] as Record<string, unknown> | undefined;
    const content = innerMsg?.["content"] ?? msg["content"];
    if (!Array.isArray(content)) return undefined;
    for (const block of content as Array<Record<string, unknown>>) {
      if (block["type"] === "tool_use" && typeof block["input"] === "object" && block["input"] !== null) {
        return block["input"] as Record<string, unknown>;
      }
    }
    return undefined;
  }

  private _extractToolUseId(message: unknown): string | undefined {
    if (message === null || typeof message !== "object") return undefined;
    const msg = message as Record<string, unknown>;
    const innerMsg = msg["message"] as Record<string, unknown> | undefined;
    const content = innerMsg?.["content"] ?? msg["content"];
    if (!Array.isArray(content)) return undefined;
    for (const block of content as Array<Record<string, unknown>>) {
      if (block["type"] === "tool_use" && typeof block["id"] === "string") {
        return block["id"];
      }
    }
    return undefined;
  }

  private _extractToolNameFromResult(message: unknown): string | undefined {
    if (message === null || typeof message !== "object") return undefined;
    const msg = message as Record<string, unknown>;
    const innerMsg = msg["message"] as Record<string, unknown> | undefined;
    const content = innerMsg?.["content"] ?? msg["content"];
    if (!Array.isArray(content)) return undefined;
    for (const block of content as Array<Record<string, unknown>>) {
      if (block["type"] === "tool_result" && typeof block["name"] === "string") {
        return block["name"];
      }
    }
    return undefined;
  }

  private readonly HOOK_TIMEOUT_MS = 30_000; // 30 seconds default

  private _executeHook(
    hook: { hookId: string; event: HookEvent; command: string; matcher?: string },
    sessionId: string,
    workspace?: string,
  ): Promise<{ exitCode: number | null; stdout: string; stderr: string; durationMs: number; timedOut: boolean }> {
    return new Promise((resolve) => {
      const start = Date.now();
      const cwd = workspace ?? process.cwd();

      const child = spawn(hook.command, {
        shell: true,
        cwd,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, this.HOOK_TIMEOUT_MS);

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      child.on("error", () => {
        clearTimeout(timer);
        resolve({
          exitCode: null,
          stdout: stdout.slice(0, 4096),
          stderr: stderr.slice(0, 4096),
          durationMs: Date.now() - start,
          timedOut,
        });
      });

      child.on("close", (code: number | null) => {
        clearTimeout(timer);
        resolve({
          exitCode: code,
          stdout: stdout.slice(0, 4096),
          stderr: stderr.slice(0, 4096),
          durationMs: Date.now() - start,
          timedOut,
        });
      });
    });
  }

  private _emitHookNotification(
    hook: { hookId: string; event: HookEvent; command: string; matcher?: string },
    sessionId: string,
    result: { exitCode: number | null; stdout: string; stderr: string; durationMs: number; timedOut: boolean } | null,
  ): void {
    this.notify({
      jsonrpc: "2.0",
      method: "bridge/hook_triggered",
      params: {
        sessionId,
        hookId: hook.hookId,
        event: hook.event,
        command: hook.command,
        ...(hook.matcher && { matcher: hook.matcher }),
        ...(result !== null
          ? {
              exitCode: result.exitCode,
              stdout: result.stdout,
              stderr: result.stderr,
              durationMs: result.durationMs,
              timedOut: result.timedOut,
            }
          : {
              exitCode: null,
              stdout: null,
              stderr: null,
              durationMs: null,
              timedOut: false,
            }),
      },
    });
  }

  /**
   * Execute hook commands for matching hooks.
   * Returns true if all blocking hooks passed (exit 0), false if any blocking hook failed.
   */
  private async _fireHooks(
    event: HookEvent,
    sessionId: string,
    workspace?: string,
    toolName?: string,
  ): Promise<boolean> {
    const matchingHooks = this.hooksStore.findMatching(event, toolName, workspace);
    const isBlocking = this.hooksStore.isBlocking(event);

    if (matchingHooks.length === 0) {
      return true;
    }

    if (isBlocking) {
      // Execute blocking hooks sequentially; stop on first failure
      for (const hook of matchingHooks) {
        const result = await this._executeHook(hook, sessionId, workspace);
        this._emitHookNotification(hook, sessionId, result);
        this.auditLog.write(
          this.auditLog.createEntry(sessionId, "hook_execution", "security", {
            hookId: hook.hookId,
            event: hook.event,
            command: hook.command,
            exitCode: result.exitCode,
            durationMs: result.durationMs,
            timedOut: result.timedOut,
          }, { workspace }),
        );
        if (result.exitCode !== 0) {
          return false; // Tool use must be aborted
        }
      }
      return true;
    }

    // Non-blocking: fire-and-forget
    for (const hook of matchingHooks) {
      this._emitHookNotification(hook, sessionId, null);
      this.auditLog.write(
        this.auditLog.createEntry(sessionId, "hook_execution", "security", {
          hookId: hook.hookId,
          event: hook.event,
          command: hook.command,
          exitCode: null as unknown as number,
          durationMs: null as unknown as number,
          timedOut: false,
        }, { workspace }),
      );
      this._executeHook(hook, sessionId, workspace).then((result) => {
        // Re-emit notification with actual result after completion
        this._emitHookNotification(hook, sessionId, result);
        this.auditLog.write(
          this.auditLog.createEntry(sessionId, "hook_execution", "security", {
            hookId: hook.hookId,
            event: hook.event,
            command: hook.command,
            exitCode: result.exitCode,
            durationMs: result.durationMs,
            timedOut: result.timedOut,
          }, { workspace }),
        );
      });
    }

    return true;
  }

  private _emitFileChange(
    sessionId: string,
    toolName: string | undefined,
    message: unknown,
    workspace: string,
  ): void {
    if (toolName !== "Write" && toolName !== "Edit") return;

    const msg = message as Record<string, unknown> | null;
    if (!msg || typeof msg !== "object") return;

    const innerMsg = msg["message"] as Record<string, unknown> | undefined;
    const content = innerMsg?.["content"] ?? msg["content"];
    if (!Array.isArray(content)) return;

    for (const block of content as Array<Record<string, unknown>>) {
      if (block["type"] !== "tool_use") continue;
      if (block["name"] !== "Write" && block["name"] !== "Edit") continue;

      const input = block["input"] as Record<string, unknown> | undefined;
      if (!input || typeof input["file_path"] !== "string") continue;

      const filePath = input["file_path"] as string;
      const relativePath = path.isAbsolute(filePath) ? path.relative(workspace, filePath) : filePath;

      if (block["name"] === "Write") {
        const existed = fs.existsSync(filePath);
        this.notify({
          jsonrpc: "2.0",
          method: "bridge/file_changed",
          params: {
            sessionId,
            path: relativePath,
            action: existed ? "modified" : "created",
          },
        });
      } else {
        // Edit
        this.notify({
          jsonrpc: "2.0",
          method: "bridge/file_changed",
          params: {
            sessionId,
            path: relativePath,
            action: "modified",
          },
        });
      }
    }
  }

  // --- MCP methods ---

  private mcpAdd(params: Record<string, unknown>): unknown {
    const { workspace, name, command, args, env } = params;

    if (!workspace || typeof workspace !== "string") {
      throw new BridgeError(-32602, "'workspace' must be provided");
    }
    if (!name || typeof name !== "string") {
      throw new BridgeError(-32602, "'name' must be provided");
    }
    if (!command || typeof command !== "string") {
      throw new BridgeError(-32602, "'command' must be provided");
    }

    const resolvedWorkspace = path.resolve(workspace);
    if (!fs.existsSync(resolvedWorkspace) || !fs.statSync(resolvedWorkspace).isDirectory()) {
      throw new BridgeError(-32001, "Workspace path does not exist", { workspace: resolvedWorkspace });
    }

    const config: McpServerConfig = {
      name,
      command,
      args: Array.isArray(args) ? (args as string[]) : [],
      env: env && typeof env === "object" && !Array.isArray(env)
        ? env as Record<string, string>
        : {},
    };

    try {
      const entry = this.mcpStore.add(resolvedWorkspace, config);
      return {
        name: entry.name,
        status: entry.status,
        pid: entry.pid,
      };
    } catch (err) {
      throw new BridgeError(-32602, (err as Error).message);
    }
  }

  private mcpRemove(params: Record<string, unknown>): unknown {
    const { workspace, name } = params;

    if (!workspace || typeof workspace !== "string") {
      throw new BridgeError(-32602, "'workspace' must be provided");
    }
    if (!name || typeof name !== "string") {
      throw new BridgeError(-32602, "'name' must be provided");
    }

    const resolvedWorkspace = path.resolve(workspace);

    try {
      this.mcpStore.remove(resolvedWorkspace, name);
      return { name, removed: true };
    } catch (err) {
      throw new BridgeError(-32602, (err as Error).message);
    }
  }

  private mcpStart(params: Record<string, unknown>): unknown {
    const { workspace, name } = params;

    if (!workspace || typeof workspace !== "string") {
      throw new BridgeError(-32602, "'workspace' must be provided");
    }
    if (!name || typeof name !== "string") {
      throw new BridgeError(-32602, "'name' must be provided");
    }

    const resolvedWorkspace = path.resolve(workspace);

    try {
      const entry = this.mcpStore.start(resolvedWorkspace, name);
      return { name: entry.name, status: entry.status, pid: entry.pid };
    } catch (err) {
      throw new BridgeError(-32602, (err as Error).message);
    }
  }

  private mcpStop(params: Record<string, unknown>): unknown {
    const { workspace, name } = params;

    if (!workspace || typeof workspace !== "string") {
      throw new BridgeError(-32602, "'workspace' must be provided");
    }
    if (!name || typeof name !== "string") {
      throw new BridgeError(-32602, "'name' must be provided");
    }

    const resolvedWorkspace = path.resolve(workspace);

    try {
      const entry = this.mcpStore.stop(resolvedWorkspace, name);
      return { name: entry.name, status: entry.status };
    } catch (err) {
      throw new BridgeError(-32602, (err as Error).message);
    }
  }

  private mcpList(params: Record<string, unknown>): unknown {
    const { workspace } = params;

    if (!workspace || typeof workspace !== "string") {
      throw new BridgeError(-32602, "'workspace' must be provided");
    }

    const resolvedWorkspace = path.resolve(workspace);
    const servers = this.mcpStore.list(resolvedWorkspace);
    return { servers };
  }

  // --- Config methods ---

  private configGet(params: Record<string, unknown>): unknown {
    const { key, workspace } = params;

    if (!key || typeof key !== "string") {
      throw new BridgeError(-32602, "'key' must be provided");
    }

    const resolvedWorkspace = typeof workspace === "string" ? path.resolve(workspace) : undefined;
    const entry = this.configStore.get(key, resolvedWorkspace);

    if (!entry) {
      return { key, value: null, scope: null };
    }

    return entry;
  }

  private configSet(params: Record<string, unknown>): unknown {
    const { key, value, scope, workspace } = params;

    if (!key || typeof key !== "string") {
      throw new BridgeError(-32602, "'key' must be provided");
    }
    if (value === undefined) {
      throw new BridgeError(-32602, "'value' must be provided");
    }
    if (scope !== "project" && scope !== "user") {
      throw new BridgeError(-32602, "'scope' must be 'project' or 'user'");
    }

    const resolvedWorkspace = typeof workspace === "string" ? path.resolve(workspace) : undefined;

    try {
      return this.configStore.set(key, value, { scope, workspace: resolvedWorkspace });
    } catch (err) {
      throw new BridgeError(-32602, (err as Error).message);
    }
  }

  private configList(params: Record<string, unknown>): unknown {
    const { workspace } = params;
    const resolvedWorkspace = typeof workspace === "string" ? path.resolve(workspace) : undefined;
    const settings = this.configStore.list(resolvedWorkspace);
    return { settings };
  }

  // --- Hooks methods ---

  private hooksAdd(params: Record<string, unknown>): unknown {
    const { event, command, matcher, scope, workspace } = params;

    if (!event || typeof event !== "string") {
      throw new BridgeError(-32602, "'event' must be provided");
    }
    if (!command || typeof command !== "string") {
      throw new BridgeError(-32602, "'command' must be provided");
    }
    if (scope !== "project" && scope !== "user") {
      throw new BridgeError(-32602, "'scope' must be 'project' or 'user'");
    }

    const resolvedWorkspace = typeof workspace === "string" ? path.resolve(workspace) : undefined;

    try {
      return this.hooksStore.add({
        event,
        command,
        matcher: typeof matcher === "string" ? matcher : undefined,
        scope,
        workspace: resolvedWorkspace,
      });
    } catch (err) {
      throw new BridgeError(-32602, (err as Error).message);
    }
  }

  private hooksRemove(params: Record<string, unknown>): unknown {
    const { hookId } = params;

    if (!hookId || typeof hookId !== "string") {
      throw new BridgeError(-32602, "'hookId' must be provided");
    }

    try {
      this.hooksStore.remove(hookId);
      return { hookId, removed: true };
    } catch (err) {
      throw new BridgeError(-32602, (err as Error).message);
    }
  }

  private hooksList(params: Record<string, unknown>): unknown {
    const { workspace } = params;
    const resolvedWorkspace = typeof workspace === "string" ? path.resolve(workspace) : undefined;
    const hooks = this.hooksStore.list(resolvedWorkspace);
    return { hooks };
  }

  // --- Context methods ---

  private contextRead(params: Record<string, unknown>): unknown {
    const { scope, path: relPath, workspace } = params;

    if (scope !== "project" && scope !== "user") {
      throw new BridgeError(-32602, "'scope' must be 'project' or 'user'");
    }
    if (!relPath || typeof relPath !== "string") {
      throw new BridgeError(-32602, "'path' must be provided");
    }

    const resolvedWorkspace = typeof workspace === "string" ? path.resolve(workspace) : undefined;

    if (resolvedWorkspace) {
      if (!fs.existsSync(resolvedWorkspace) || !fs.statSync(resolvedWorkspace).isDirectory()) {
        throw new BridgeError(-32001, "Workspace path does not exist", { workspace: resolvedWorkspace });
      }
    }

    try {
      return this.contextStore.read(scope as "project" | "user", relPath, resolvedWorkspace);
    } catch (err: unknown) {
      if (err && typeof err === "object" && (err as { code?: number }).code === -32001) {
        throw new BridgeError(-32001, "File not found", { path: relPath });
      }
      throw new BridgeError(-32602, (err as Error).message);
    }
  }

  private contextWrite(params: Record<string, unknown>): unknown {
    const { scope, path: relPath, content, workspace } = params;

    if (scope !== "project" && scope !== "user") {
      throw new BridgeError(-32602, "'scope' must be 'project' or 'user'");
    }
    if (!relPath || typeof relPath !== "string") {
      throw new BridgeError(-32602, "'path' must be provided");
    }
    if (typeof content !== "string") {
      throw new BridgeError(-32602, "'content' must be a string");
    }

    const resolvedWorkspace = typeof workspace === "string" ? path.resolve(workspace) : undefined;

    if (resolvedWorkspace) {
      if (!fs.existsSync(resolvedWorkspace) || !fs.statSync(resolvedWorkspace).isDirectory()) {
        throw new BridgeError(-32001, "Workspace path does not exist", { workspace: resolvedWorkspace });
      }
    }

    try {
      return this.contextStore.write(scope as "project" | "user", relPath, content, resolvedWorkspace);
    } catch (err) {
      throw new BridgeError(-32602, (err as Error).message);
    }
  }

  private contextList(params: Record<string, unknown>): unknown {
    const { workspace } = params;
    const resolvedWorkspace = typeof workspace === "string" ? workspace : undefined;
    const files = this.contextStore.list(resolvedWorkspace);
    return { files };
  }

  // --- Session branch ---

  private async branchSession(
    params: Record<string, unknown>,
    requestId: unknown,
  ): Promise<unknown> {
    const { sessionId, fromIndex, prompt } = params;

    if (!sessionId || typeof sessionId !== "string") {
      throw new BridgeError(-32602, "'sessionId' must be provided");
    }

    const source = this.sessionStore.get(sessionId);
    if (!source) {
      throw new BridgeError(-32011, "Session not found", { sessionId });
    }

    let branchIndex = source.history.length;
    if (fromIndex !== undefined) {
      if (typeof fromIndex !== "number" || !Number.isInteger(fromIndex) || fromIndex < 0) {
        throw new BridgeError(-32602, "'fromIndex' must be a non-negative integer");
      }
      if (fromIndex > source.history.length) {
        throw new BridgeError(-32602, `'fromIndex' ${fromIndex} exceeds history length ${source.history.length}`);
      }
      branchIndex = fromIndex;
    }

    // Create new session in the same workspace
    const branchPrompt = typeof prompt === "string" ? prompt : "(branched session)";
    const newSession = this.sessionStore.create(source.workspace, branchPrompt);

    this.auditLog.write(
      this.auditLog.createEntry(newSession.id, "session_branched", "lifecycle", {
        workspace: source.workspace,
        parentSessionId: sessionId,
        fromIndex: branchIndex,
      }, { workspace: source.workspace, parentSessionId: sessionId }),
    );

    // Copy history from source up to branchIndex
    const copiedHistory = source.history.slice(0, branchIndex);
    for (const entry of copiedHistory) {
      this.sessionStore.appendEvent(newSession.id, {
        type: "branch_from",
        message: entry,
      });
    }

    this.emit(
      "bridge/session_event",
      { sessionId: newSession.id, type: "session_started" },
      requestId,
    );

    // If prompt is provided, start the branched session
    if (typeof prompt === "string") {
      this.sessionStore.transitionExecutionState(newSession.id, "running", "query_started");

      const options: Record<string, unknown> = {};
      // Only try SDK resume when branching from the full history end.
      // If fromIndex is set, the SDK has no concept of a mid-point branch,
      // so a fresh session is more appropriate.
      if (source.sdkSessionId && branchIndex === source.history.length) {
        options["resume"] = source.sdkSessionId;
      }

      return this._runQuery(
        newSession,
        prompt,
        options,
        { cwd: source.workspace, env: undefined },
        requestId,
      );
    }

    return {
      sessionId: newSession.id,
      workspace: newSession.workspace,
      branchedFrom: sessionId,
      historyCopied: branchIndex,
    };
  }

  // --- Version negotiation ---

  private negotiateVersion(params: Record<string, unknown>): unknown {
    const { supportedVersions } = params;

    if (!Array.isArray(supportedVersions) || supportedVersions.length === 0) {
      throw new BridgeError(-32602, "'supportedVersions' must be a non-empty array of strings");
    }

    if (!supportedVersions.every((v) => typeof v === "string")) {
      throw new BridgeError(-32602, "'supportedVersions' must contain only strings");
    }

    const matched = supportedVersions.find((v) => v === API_VERSION);
    if (!matched) {
      throw new BridgeError(VERSION_MISMATCH, "No compatible API version found", {
        supportedVersions: [API_VERSION],
      });
    }

    return {
      negotiatedVersion: matched,
      capabilities: getCapabilities(),
    };
  }

  // --- Bridge log level ---

  private setLogLevel(params: Record<string, unknown>): unknown {
    const { level } = params;

    if (typeof level !== "string" || !VALID_LOG_LEVELS.has(level.toLowerCase())) {
      throw new BridgeError(-32602, `'level' must be one of: ${[...VALID_LOG_LEVELS].join(", ")}`);
    }

    this.logger.setLevel(level.toLowerCase() as LogLevel);
    return { level: this.logger.getLevel() };
  }

  // --- Session search ---

  private searchSessions(params: Record<string, unknown>): unknown {
    const { query, workspace, status, limit } = params;

    if (!query || typeof query !== "string") {
      throw new BridgeError(-32602, "'query' must be a non-empty string");
    }

    if (limit !== undefined && (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1)) {
      throw new BridgeError(-32602, "'limit' must be a positive integer");
    }

    const resolvedLimit = Math.min(typeof limit === "number" ? limit : 20, 100);
    const resolvedWorkspace = typeof workspace === "string" ? path.resolve(workspace) : undefined;

    const allSessions = this.sessionStore.list({ status: "all" });

    const results: Array<{
      sessionId: string;
      workspace: string;
      status: string;
      matches: Array<{ historyIndex: number; snippet: string }>;
    }> = [];

    for (const session of allSessions) {
      // Filter by workspace
      if (resolvedWorkspace && session.workspace !== resolvedWorkspace) continue;

      // Filter by status
      if (typeof status === "string" && session.status !== status) continue;

      const matches: Array<{ historyIndex: number; snippet: string }> = [];

      for (let i = 0; i < session.history.length; i++) {
        const entry = session.history[i];
        const text = entry.prompt ?? JSON.stringify(entry.message ?? "");
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const idx = lowerText.indexOf(lowerQuery);

        if (idx !== -1) {
          // Build snippet with context around match
          const start = Math.max(0, idx - 40);
          const end = Math.min(text.length, idx + query.length + 40);
          const snippet = (start > 0 ? "..." : "") + text.slice(start, end) + (end < text.length ? "..." : "");
          matches.push({ historyIndex: i, snippet });
        }
      }

      if (matches.length > 0) {
        results.push({
          sessionId: session.id,
          workspace: session.workspace,
          status: session.status,
          matches,
        });
      }

      if (results.length >= resolvedLimit) break;
    }

    return { results };
  }

  // --- Session export/delete/cleanup ---

  private exportSession(params: Record<string, unknown>): unknown {
    const { sessionId } = params;
    if (!sessionId || typeof sessionId !== "string") {
      throw new BridgeError(-32602, "'sessionId' must be provided");
    }

    const session = this.sessionStore.get(sessionId);
    if (!session) {
      throw new BridgeError(-32011, "Session not found", { sessionId });
    }

    return {
      id: session.id,
      workspace: session.workspace,
      parentSessionId: session.parentSessionId ?? null,
      sdkSessionId: session.sdkSessionId,
      status: session.status,
      executionState: session.executionState,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      history: session.history,
      result: session.result,
      pausedAt: session.pausedAt ?? null,
      pauseReason: session.pauseReason ?? null,
      cancelledAt: session.cancelledAt ?? null,
      cancelReason: session.cancelReason ?? null,
      timeoutMs: session.timeoutMs ?? null,
    };
  }

  private deleteSession(params: Record<string, unknown>): unknown {
    const { sessionId } = params;
    if (!sessionId || typeof sessionId !== "string") {
      throw new BridgeError(-32602, "'sessionId' must be provided");
    }

    const session = this.sessionStore.get(sessionId);
    if (!session) {
      throw new BridgeError(-32011, "Session not found", { sessionId });
    }

    if (session.status === "active") {
      throw new BridgeError(SESSION_ACTIVE, "Cannot delete an active session", { sessionId });
    }

    this.sessionStore.delete(sessionId);
    return { deleted: true, sessionId };
  }

  private cleanupSessions(params: Record<string, unknown>): unknown {
    const { olderThanDays } = params;

    if (olderThanDays !== undefined) {
      if (typeof olderThanDays !== "number" || !Number.isInteger(olderThanDays) || olderThanDays < 1) {
        throw new BridgeError(-32602, "'olderThanDays' must be an integer >= 1");
      }
    }

    const days = Math.min(typeof olderThanDays === "number" ? olderThanDays : 30, 365);
    const removedCount = this.sessionStore.cleanup(days);
    return { removedCount };
  }

  // --- Custom Tool methods ---

  private registerTool(params: Record<string, unknown>): unknown {
    const { workspace, name, description, command, args } = params;

    if (!workspace || typeof workspace !== "string") {
      throw new BridgeError(-32602, "'workspace' must be provided");
    }
    if (!name || typeof name !== "string") {
      throw new BridgeError(-32602, "'name' must be provided");
    }
    if (!description || typeof description !== "string") {
      throw new BridgeError(-32602, "'description' must be provided");
    }
    if (!command || typeof command !== "string") {
      throw new BridgeError(-32602, "'command' must be provided");
    }

    // Validate tool name prefix
    if (!name.startsWith("custom.")) {
      throw new BridgeError(-32602, "Tool name must start with 'custom.'");
    }

    const resolvedWorkspace = path.resolve(workspace);

    // Check workspace is registered
    if (!this.workspaceStore.has(resolvedWorkspace)) {
      throw new BridgeError(-32602, "Workspace must be registered first");
    }

    // Validate args if provided
    const validatedArgs = Array.isArray(args) && args.every((a) => typeof a === "string")
      ? (args as string[])
      : [];

    const tool = this.workspaceStore.registerTool(resolvedWorkspace, {
      name,
      description,
      command,
      args: validatedArgs,
    });

    return { tool };
  }

  private unregisterTool(params: Record<string, unknown>): unknown {
    const { workspace, name } = params;

    if (!workspace || typeof workspace !== "string") {
      throw new BridgeError(-32602, "'workspace' must be provided");
    }
    if (!name || typeof name !== "string") {
      throw new BridgeError(-32602, "'name' must be provided");
    }

    const resolvedWorkspace = path.resolve(workspace);
    const success = this.workspaceStore.unregisterTool(resolvedWorkspace, name);

    return { success };
  }

  private listTools(params: Record<string, unknown>): unknown {
    const { workspace } = params;

    // If no workspace specified, return only built-in tools (backward compatible)
    if (!workspace) {
      return { tools: BUILTIN_TOOLS };
    }

    if (typeof workspace !== "string") {
      throw new BridgeError(-32602, "'workspace' must be a string");
    }

    const resolvedWorkspace = path.resolve(workspace);
    const customTools = this.workspaceStore.listTools(resolvedWorkspace);

    // Merge built-in tools with custom tools
    const allTools = [
      ...BUILTIN_TOOLS,
      ...customTools.map((t) => ({ name: t.name, description: t.description })),
    ];

    return { tools: allTools };
  }

  // --- Custom Tool Helper methods ---

  private _getAvailableCustomTools(
    workspace: string,
    allowedTools: string[] | undefined,
    disallowedTools: string[] | undefined,
  ): CustomTool[] {
    const allCustomTools = this.workspaceStore.listTools(workspace);

    return allCustomTools.filter((tool) => {
      // If allowedTools is specified, tool must be in the list
      if (allowedTools !== undefined && !allowedTools.includes(tool.name)) {
        return false;
      }
      // If disallowedTools is specified, tool must not be in the list
      if (disallowedTools !== undefined && disallowedTools.includes(tool.name)) {
        return false;
      }
      return true;
    });
  }

  private _buildCustomToolInstructions(customTools: CustomTool[]): string {
    const toolDescriptions = customTools
      .map((t) => `- ${t.name}: ${t.description} (command: ${t.command}${t.args.length > 0 ? ' ' + t.args.join(' ') : ''})`)
      .join('\n');

    return `You have access to the following custom tools that are specific to this workspace:
${toolDescriptions}

To use a custom tool, invoke the Bash tool with the following command format:
__custom_tool__:<tool_name> [additional_args...]

For example: __custom_tool__:custom.build --verbose`;
  }

  // --- Webhook methods ---

  private webhookSubscribe(params: Record<string, unknown>): unknown {
    const { url } = params;
    if (typeof url !== "string") {
      throw new BridgeError(-32602, "'url' must be a string");
    }
    try {
      new URL(url);
    } catch {
      throw new BridgeError(-32602, "'url' must be a valid URL");
    }

    const reg = this.webhookManager.subscribe(url);
    return { id: reg.id, url: reg.url, secret: this.webhookManager.getSecret() };
  }

  private webhookUnsubscribe(params: Record<string, unknown>): unknown {
    const { id } = params;
    if (typeof id !== "string") {
      throw new BridgeError(-32602, "'id' must be a string");
    }
    const removed = this.webhookManager.unsubscribe(id);
    if (!removed) {
      throw new BridgeError(-32011, "Webhook not found");
    }
    return { removed: true };
  }

  // --- Template methods ---

  private templateCreate(params: Record<string, unknown>): unknown {
    const { name, model, allowedTools, disallowedTools, permissionMode, maxTurns, systemPrompt } = params;

    if (!name || typeof name !== "string") {
      throw new BridgeError(-32602, "'name' must be a string");
    }

    // Validate parameters using same logic as session.start
    const controlParams = validateAgentControlParams({ model, allowedTools, disallowedTools, permissionMode, maxTurns, systemPrompt });

    const template = this.templateStore.create({
      name,
      model: controlParams.model,
      allowedTools: controlParams.allowedTools,
      disallowedTools: controlParams.disallowedTools,
      permissionMode: controlParams.permissionMode,
      maxTurns: controlParams.maxTurns,
      systemPrompt: controlParams.systemPrompt,
    });

    return template;
  }

  private templateGet(params: Record<string, unknown>): unknown {
    const { name } = params;
    if (!name || typeof name !== "string") {
      throw new BridgeError(-32602, "'name' must be a string");
    }
    return this.templateStore.get(name);
  }

  private templateList(): unknown {
    return { templates: this.templateStore.list() };
  }

  private templateDelete(params: Record<string, unknown>): unknown {
    const { name } = params;
    if (!name || typeof name !== "string") {
      throw new BridgeError(-32602, "'name' must be a string");
    }
    const removed = this.templateStore.delete(name);
    return { removed };
  }
}
