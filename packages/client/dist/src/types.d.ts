export interface JsonRpcRequest {
    jsonrpc: "2.0";
    id: string | number | null;
    method: string;
    params?: Record<string, unknown>;
}
export interface JsonRpcResponse {
    jsonrpc: "2.0";
    id: string | number | null;
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}
export interface JsonRpcNotification {
    jsonrpc: "2.0";
    method: string;
    params: Record<string, unknown>;
}
export interface BridgeCapabilitiesResult {
    protocol: string;
    transport: "stdio" | "http" | "ws";
    bridgeVersion: string;
    apiVersion: string;
    streaming: boolean;
    notifications: {
        progress: boolean;
        sessionEvent: boolean;
    };
    workflows: string[];
    skills: unknown[];
    workflowSkillMap: Record<string, unknown>;
    methods: string[];
    agentControlParams: string[];
    models: Array<Record<string, unknown>>;
    tools: Array<Record<string, unknown>>;
    hookEvents: string[];
    ui: {
        enabled: boolean;
        path: string;
    };
}
export interface BridgeNegotiateVersionParams {
    supportedVersions: unknown[];
}
export interface BridgeNegotiateVersionResult {
    negotiatedVersion: string;
    capabilities: Record<string, unknown>;
}
export interface SkillsListResult {
    skills: unknown[];
}
export interface WorkflowRunParams {
    workspace: string;
    workflow: "init" | "propose" | "modify" | "apply" | "verify" | "archive" | "cancel" | "list";
    args?: unknown[];
}
export interface WorkflowRunResult {
    workflow: string;
    workspace: string;
    stdout: string;
    stderr: string;
    parsed: unknown;
}
export interface SessionStartParams {
    workspace: string;
    prompt: string;
    options?: Record<string, unknown>;
}
export interface SessionStartResult {
    sessionId: string;
    status: "completed" | "stopped" | "interrupted";
    result: unknown | null;
}
export interface SessionResumeParams {
    sessionId: string;
    prompt: string;
    options?: Record<string, unknown>;
}
export interface SessionResumeResult {
    sessionId: string;
    status: "completed" | "stopped" | "interrupted";
    result: unknown | null;
}
export interface SessionStopParams {
    sessionId: string;
}
export interface SessionStopResult {
    sessionId: string;
    status: "stopped";
}
export interface SessionStatusParams {
    sessionId: string;
}
export interface SessionStatusResult {
    sessionId: string;
    status: "active" | "completed" | "stopped" | "interrupted";
    createdAt: string;
    updatedAt: string;
    historyLength: number;
    result: unknown | null;
}
export interface JsonRpcError {
    code: number;
    message: string;
    data?: unknown;
}
export interface InternalErrorErrorData {
    message: string;
}
export interface WorkspaceNotFoundErrorData {
    workspace: string;
}
export interface ScriptNotFoundErrorData {
    scriptPath: string;
}
export interface WorkflowFailedErrorData {
    workflow: string;
    workspace: string;
    message: string;
    stdout: string;
    stderr: string;
    code: unknown;
}
export interface SessionNotFoundErrorData {
    sessionId: string;
}
export interface SDKUnavailableErrorData {
    hint: string;
}
export interface VersionMismatchErrorData {
    supportedVersions: unknown[];
}
export type NotificationMethod = "bridge/progress" | "bridge/session_event" | "bridge/subagent_event" | "bridge/hook_triggered" | "bridge/file_changed" | "bridge/tool_approval_requested";
export type CapabilitiesResult = BridgeCapabilitiesResult;
export type PingResult = {
    pong: boolean;
    ts: string;
};
export type NegotiateVersionParams = BridgeNegotiateVersionParams;
export type NegotiateVersionResult = BridgeNegotiateVersionResult;
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "silent";
export type SetLogLevelParams = {
    level: LogLevel;
};
export type SetLogLevelResult = {
    level: LogLevel;
};
export interface RuntimeInfo {
    bridgeVersion: string;
    apiVersion: string;
    transport: string;
    authMode: string;
    logLevel: string;
    sessionsPath: string;
    keysPath: string;
    specDrivenScriptPath: string;
    http: Record<string, unknown> | null;
    nodeVersion: string;
}
export interface SkillInfo {
    name: string;
    description: string;
    hasScript: boolean;
    parameters: string[];
}
export interface ModelInfo {
    id: string;
    displayName: string;
}
export interface ToolInfo {
    name: string;
    description: string;
}
export type PermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "approve";
export type ProxyParams = {
    http?: string;
    https?: string;
    noProxy?: string;
};
export type SessionResult = SessionStartResult;
export interface SessionSpawnParams extends SessionStartParams {
    parentSessionId?: string;
}
export type SessionListParams = Record<string, unknown>;
export type SessionListItem = Record<string, unknown>;
export type SessionListResult = {
    sessions: SessionListItem[];
};
export type SessionHistoryParams = {
    sessionId: string;
    offset?: number;
    limit?: number;
};
export type SessionHistoryEntry = Record<string, unknown>;
export type SessionHistoryResult = {
    sessionId: string;
    total: number;
    entries: SessionHistoryEntry[];
};
export type BufferedEvent = Record<string, unknown>;
export type SessionEventsParams = {
    sessionId: string;
    since?: number;
    limit?: number;
};
export type SessionEventsResult = {
    events: BufferedEvent[];
    nextSeq: number;
};
export type SessionExportParams = {
    sessionId: string;
};
export type SessionExportResult = Record<string, unknown>;
export type SessionDeleteParams = {
    sessionId: string;
};
export type SessionDeleteResult = {
    sessionId: string;
    deleted: boolean;
};
export type SessionCleanupParams = {
    olderThanDays?: number;
};
export type SessionCleanupResult = {
    deleted: number;
};
export type SessionApproveToolParams = {
    sessionId?: string;
    requestId: string;
};
export type SessionRejectToolParams = {
    sessionId?: string;
    requestId: string;
    message?: string;
};
export type ApprovalResult = Record<string, unknown>;
export type SessionBranchParams = {
    sessionId: string;
    prompt?: string;
    fromIndex?: number;
};
export type SessionSearchParams = {
    query: string;
    workspace?: string;
    limit?: number;
};
export type SearchResult = Record<string, unknown>;
export type SessionSearchResult = {
    sessions: SearchResult[];
};
export type WorkflowName = "init" | "propose" | "modify" | "apply" | "verify" | "archive" | "cancel" | "list" | "maintenance" | "migrate";
export type ModelsListResult = {
    models: ModelInfo[];
};
export type ToolsListResult = {
    tools: ToolInfo[];
};
export type WorkspaceRegisterParams = {
    workspace: string;
};
export type WorkspaceListResult = {
    workspaces: unknown[];
};
export type McpAddParams = Record<string, unknown>;
export type McpRemoveParams = {
    name: string;
    workspace?: string;
};
export type McpStartParams = {
    name: string;
    workspace?: string;
};
export type McpStopParams = {
    name: string;
    workspace?: string;
};
export type McpListParams = {
    workspace?: string;
};
export type McpEntry = Record<string, unknown>;
export type McpListResult = {
    servers: McpEntry[];
};
export type ConfigGetParams = Record<string, unknown>;
export type ConfigSetParams = Record<string, unknown>;
export type ConfigListParams = Record<string, unknown>;
export type ConfigEntry = Record<string, unknown>;
export type ConfigListResult = {
    entries: ConfigEntry[];
};
export type HookEvent = "pre_tool_use" | "post_tool_use" | "notification" | "stop" | "subagent_stop";
export type HooksAddParams = Record<string, unknown>;
export type HooksRemoveParams = {
    hookId?: string;
    id?: string;
};
export type HooksListParams = Record<string, unknown>;
export type HookEntry = Record<string, unknown>;
export type HooksListResult = {
    hooks: HookEntry[];
};
export type ContextReadParams = Record<string, unknown>;
export type ContextWriteParams = Record<string, unknown>;
export type ContextListParams = Record<string, unknown>;
export type ContextListResult = {
    files: unknown[];
};
export type SessionEventType = string;
export type SessionEventNotification = JsonRpcNotification;
export type SubagentEventNotification = JsonRpcNotification;
export type ProgressNotification = JsonRpcNotification;
export type ToolApprovalNotification = JsonRpcNotification;
export type FileChangedNotification = JsonRpcNotification;
//# sourceMappingURL=types.d.ts.map