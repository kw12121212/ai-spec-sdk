import type { Transport } from "./transport.js";
import type { CapabilitiesResult, PingResult, NegotiateVersionParams, NegotiateVersionResult, SetLogLevelParams, SetLogLevelResult, RuntimeInfo, SessionStartParams, SessionResult, SessionResumeParams, SessionStopParams, SessionStopResult, SessionStatusParams, SessionStatusResult, SessionListParams, SessionListResult, SessionHistoryParams, SessionHistoryResult, SessionEventsParams, SessionEventsResult, SessionExportParams, SessionExportResult, SessionDeleteParams, SessionDeleteResult, SessionCleanupParams, SessionCleanupResult, SessionApproveToolParams, SessionRejectToolParams, ApprovalResult, SessionBranchParams, SessionSearchParams, SessionSearchResult, WorkflowRunParams, WorkflowRunResult, ModelsListResult, ToolsListResult, WorkspaceRegisterParams, WorkspaceListResult, McpAddParams, McpRemoveParams, McpStartParams, McpStopParams, McpListParams, McpListResult, ConfigGetParams, ConfigSetParams, ConfigListParams, ConfigListResult, HooksAddParams, HooksRemoveParams, HooksListParams, HooksListResult, ContextReadParams, ContextWriteParams, ContextListParams, ContextListResult, JsonRpcNotification, NotificationMethod } from "./types.js";
type NotificationHandler = (notification: JsonRpcNotification) => void;
export declare class BridgeClient {
    private readonly transport;
    private handlers;
    private wildcardHandlers;
    constructor(transport: Transport);
    private dispatchNotification;
    on(method: NotificationMethod | "*", handler: NotificationHandler): void;
    off(method: NotificationMethod | "*", handler: NotificationHandler): void;
    close(): void;
    get isClosed(): boolean;
    capabilities(): Promise<CapabilitiesResult>;
    ping(): Promise<PingResult>;
    negotiateVersion(params: NegotiateVersionParams): Promise<NegotiateVersionResult>;
    info(): Promise<RuntimeInfo>;
    setLogLevel(params: SetLogLevelParams): Promise<SetLogLevelResult>;
    sessionStart(params: SessionStartParams): Promise<SessionResult>;
    sessionResume(params: SessionResumeParams): Promise<SessionResult>;
    sessionStop(params: SessionStopParams): Promise<SessionStopResult>;
    sessionStatus(params: SessionStatusParams): Promise<SessionStatusResult>;
    sessionList(params?: SessionListParams): Promise<SessionListResult>;
    sessionHistory(params: SessionHistoryParams): Promise<SessionHistoryResult>;
    sessionEvents(params: SessionEventsParams): Promise<SessionEventsResult>;
    sessionExport(params: SessionExportParams): Promise<SessionExportResult>;
    sessionDelete(params: SessionDeleteParams): Promise<SessionDeleteResult>;
    sessionCleanup(params?: SessionCleanupParams): Promise<SessionCleanupResult>;
    sessionApproveTool(params: SessionApproveToolParams): Promise<ApprovalResult>;
    sessionRejectTool(params: SessionRejectToolParams): Promise<ApprovalResult>;
    sessionBranch(params: SessionBranchParams): Promise<unknown>;
    sessionSearch(params: SessionSearchParams): Promise<SessionSearchResult>;
    workflowRun(params: WorkflowRunParams): Promise<WorkflowRunResult>;
    skillsList(): Promise<{
        skills: unknown[];
    }>;
    modelsList(): Promise<ModelsListResult>;
    toolsList(): Promise<ToolsListResult>;
    workspaceRegister(params: WorkspaceRegisterParams): Promise<{
        workspace: unknown;
    }>;
    workspaceList(): Promise<WorkspaceListResult>;
    mcpAdd(params: McpAddParams): Promise<unknown>;
    mcpRemove(params: McpRemoveParams): Promise<{
        name: string;
        removed: boolean;
    }>;
    mcpStart(params: McpStartParams): Promise<unknown>;
    mcpStop(params: McpStopParams): Promise<unknown>;
    mcpList(params: McpListParams): Promise<McpListResult>;
    configGet(params: ConfigGetParams): Promise<unknown>;
    configSet(params: ConfigSetParams): Promise<unknown>;
    configList(params?: ConfigListParams): Promise<ConfigListResult>;
    hooksAdd(params: HooksAddParams): Promise<unknown>;
    hooksRemove(params: HooksRemoveParams): Promise<{
        hookId: string;
        removed: boolean;
    }>;
    hooksList(params?: HooksListParams): Promise<HooksListResult>;
    contextRead(params: ContextReadParams): Promise<unknown>;
    contextWrite(params: ContextWriteParams): Promise<unknown>;
    contextList(params?: ContextListParams): Promise<ContextListResult>;
}
export {};
//# sourceMappingURL=client.d.ts.map