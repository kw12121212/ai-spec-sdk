import type { Transport } from "./transport.js";
import type {
  CapabilitiesResult,
  PingResult,
  NegotiateVersionParams,
  NegotiateVersionResult,
  SetLogLevelParams,
  SetLogLevelResult,
  RuntimeInfo,
  SessionStartParams,
  SessionResult,
  SessionResumeParams,
  SessionStopParams,
  SessionStopResult,
  SessionStatusParams,
  SessionStatusResult,
  SessionListParams,
  SessionListResult,
  SessionHistoryParams,
  SessionHistoryResult,
  SessionEventsParams,
  SessionEventsResult,
  SessionExportParams,
  SessionExportResult,
  SessionDeleteParams,
  SessionDeleteResult,
  SessionCleanupParams,
  SessionCleanupResult,
  SessionApproveToolParams,
  SessionRejectToolParams,
  ApprovalResult,
  SessionBranchParams,
  SessionSearchParams,
  SessionSearchResult,
  WorkflowRunParams,
  WorkflowRunResult,
  ModelsListResult,
  ToolsListResult,
  WorkspaceRegisterParams,
  WorkspaceListResult,
  McpAddParams,
  McpRemoveParams,
  McpStartParams,
  McpStopParams,
  McpListParams,
  McpListResult,
  ConfigGetParams,
  ConfigSetParams,
  ConfigListParams,
  ConfigListResult,
  HooksAddParams,
  HooksRemoveParams,
  HooksListParams,
  HooksListResult,
  ContextReadParams,
  ContextWriteParams,
  ContextListParams,
  ContextListResult,
  JsonRpcNotification,
  NotificationMethod,
} from "./types.js";

type NotificationHandler = (notification: JsonRpcNotification) => void;

export class BridgeClient {
  private handlers = new Map<string, Set<NotificationHandler>>();
  private wildcardHandlers = new Set<NotificationHandler>();

  constructor(private readonly transport: Transport) {
    this.transport.onNotification((n) => this.dispatchNotification(n));
  }

  private dispatchNotification(notification: JsonRpcNotification): void {
    const method = notification.method as NotificationMethod;

    for (const handler of this.wildcardHandlers) {
      try { handler(notification); } catch { /* swallow */ }
    }

    const specific = this.handlers.get(method);
    if (specific) {
      for (const handler of specific) {
        try { handler(notification); } catch { /* swallow */ }
      }
    }
  }

  // ── Event API ────────────────────────────────────────────────────────────

  on(method: NotificationMethod | "*", handler: NotificationHandler): void {
    if (method === "*") {
      this.wildcardHandlers.add(handler);
    } else {
      let set = this.handlers.get(method);
      if (!set) {
        set = new Set();
        this.handlers.set(method, set);
      }
      set.add(handler);
    }
  }

  off(method: NotificationMethod | "*", handler: NotificationHandler): void {
    if (method === "*") {
      this.wildcardHandlers.delete(handler);
    } else {
      this.handlers.get(method)?.delete(handler);
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  close(): void {
    this.transport.close();
  }

  get isClosed(): boolean {
    return this.transport.isClosed;
  }

  // ── Bridge methods ───────────────────────────────────────────────────────

  async capabilities(): Promise<CapabilitiesResult> {
    return this.transport.request("bridge.capabilities") as Promise<CapabilitiesResult>;
  }

  async ping(): Promise<PingResult> {
    return this.transport.request("bridge.ping") as Promise<PingResult>;
  }

  async negotiateVersion(params: NegotiateVersionParams): Promise<NegotiateVersionResult> {
    return this.transport.request("bridge.negotiateVersion", params) as Promise<NegotiateVersionResult>;
  }

  async info(): Promise<RuntimeInfo> {
    return this.transport.request("bridge.info") as Promise<RuntimeInfo>;
  }

  async setLogLevel(params: SetLogLevelParams): Promise<SetLogLevelResult> {
    return this.transport.request("bridge.setLogLevel", params) as Promise<SetLogLevelResult>;
  }

  // ── Session methods ──────────────────────────────────────────────────────

  async sessionStart(params: SessionStartParams): Promise<SessionResult> {
    return this.transport.request("session.start", params) as Promise<SessionResult>;
  }

  async sessionResume(params: SessionResumeParams): Promise<SessionResult> {
    return this.transport.request("session.resume", params) as Promise<SessionResult>;
  }

  async sessionStop(params: SessionStopParams): Promise<SessionStopResult> {
    return this.transport.request("session.stop", params) as Promise<SessionStopResult>;
  }

  async sessionStatus(params: SessionStatusParams): Promise<SessionStatusResult> {
    return this.transport.request("session.status", params) as Promise<SessionStatusResult>;
  }

  async sessionList(params?: SessionListParams): Promise<SessionListResult> {
    return this.transport.request("session.list", params) as Promise<SessionListResult>;
  }

  async sessionHistory(params: SessionHistoryParams): Promise<SessionHistoryResult> {
    return this.transport.request("session.history", params) as Promise<SessionHistoryResult>;
  }

  async sessionEvents(params: SessionEventsParams): Promise<SessionEventsResult> {
    return this.transport.request("session.events", params) as Promise<SessionEventsResult>;
  }

  async sessionExport(params: SessionExportParams): Promise<SessionExportResult> {
    return this.transport.request("session.export", params) as Promise<SessionExportResult>;
  }

  async sessionDelete(params: SessionDeleteParams): Promise<SessionDeleteResult> {
    return this.transport.request("session.delete", params) as Promise<SessionDeleteResult>;
  }

  async sessionCleanup(params?: SessionCleanupParams): Promise<SessionCleanupResult> {
    return this.transport.request("session.cleanup", params) as Promise<SessionCleanupResult>;
  }

  async sessionApproveTool(params: SessionApproveToolParams): Promise<ApprovalResult> {
    return this.transport.request("session.approveTool", params) as Promise<ApprovalResult>;
  }

  async sessionRejectTool(params: SessionRejectToolParams): Promise<ApprovalResult> {
    return this.transport.request("session.rejectTool", params) as Promise<ApprovalResult>;
  }

  async sessionBranch(params: SessionBranchParams): Promise<unknown> {
    return this.transport.request("session.branch", params);
  }

  async sessionSearch(params: SessionSearchParams): Promise<SessionSearchResult> {
    return this.transport.request("session.search", params) as Promise<SessionSearchResult>;
  }

  // ── Workflow methods ─────────────────────────────────────────────────────

  async workflowRun(params: WorkflowRunParams): Promise<WorkflowRunResult> {
    return this.transport.request("workflow.run", params) as Promise<WorkflowRunResult>;
  }

  // ── Skills ───────────────────────────────────────────────────────────────

  async skillsList(): Promise<{ skills: unknown[] }> {
    return this.transport.request("skills.list") as Promise<{ skills: unknown[] }>;
  }

  // ── Model / Tool / Workspace ─────────────────────────────────────────────

  async modelsList(): Promise<ModelsListResult> {
    return this.transport.request("models.list") as Promise<ModelsListResult>;
  }

  async toolsList(): Promise<ToolsListResult> {
    return this.transport.request("tools.list") as Promise<ToolsListResult>;
  }

  async workspaceRegister(params: WorkspaceRegisterParams): Promise<{ workspace: unknown }> {
    return this.transport.request("workspace.register", params) as Promise<{ workspace: unknown }>;
  }

  async workspaceList(): Promise<WorkspaceListResult> {
    return this.transport.request("workspace.list") as Promise<WorkspaceListResult>;
  }

  // ── MCP methods ──────────────────────────────────────────────────────────

  async mcpAdd(params: McpAddParams): Promise<unknown> {
    return this.transport.request("mcp.add", params);
  }

  async mcpRemove(params: McpRemoveParams): Promise<{ name: string; removed: boolean }> {
    return this.transport.request("mcp.remove", params) as Promise<{ name: string; removed: boolean }>;
  }

  async mcpStart(params: McpStartParams): Promise<unknown> {
    return this.transport.request("mcp.start", params);
  }

  async mcpStop(params: McpStopParams): Promise<unknown> {
    return this.transport.request("mcp.stop", params);
  }

  async mcpList(params: McpListParams): Promise<McpListResult> {
    return this.transport.request("mcp.list", params) as Promise<McpListResult>;
  }

  // ── Config methods ───────────────────────────────────────────────────────

  async configGet(params: ConfigGetParams): Promise<unknown> {
    return this.transport.request("config.get", params);
  }

  async configSet(params: ConfigSetParams): Promise<unknown> {
    return this.transport.request("config.set", params);
  }

  async configList(params?: ConfigListParams): Promise<ConfigListResult> {
    return this.transport.request("config.list", params) as Promise<ConfigListResult>;
  }

  // ── Hooks methods ────────────────────────────────────────────────────────

  async hooksAdd(params: HooksAddParams): Promise<unknown> {
    return this.transport.request("hooks.add", params);
  }

  async hooksRemove(params: HooksRemoveParams): Promise<{ hookId: string; removed: boolean }> {
    return this.transport.request("hooks.remove", params) as Promise<{ hookId: string; removed: boolean }>;
  }

  async hooksList(params?: HooksListParams): Promise<HooksListResult> {
    return this.transport.request("hooks.list", params) as Promise<HooksListResult>;
  }

  // ── Context methods ──────────────────────────────────────────────────────

  async contextRead(params: ContextReadParams): Promise<unknown> {
    return this.transport.request("context.read", params);
  }

  async contextWrite(params: ContextWriteParams): Promise<unknown> {
    return this.transport.request("context.write", params);
  }

  async contextList(params?: ContextListParams): Promise<ContextListResult> {
    return this.transport.request("context.list", params) as Promise<ContextListResult>;
  }
}
