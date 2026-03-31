// ── Common ──────────────────────────────────────────────────────────────────

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params: Record<string, unknown>;
}

// ── Capabilities ───────────────────────────────────────────────────────────

export interface CapabilitiesResult {
  protocol: string;
  transport: string;
  bridgeVersion: string;
  apiVersion: string;
  streaming: boolean;
  notifications: { progress: boolean; sessionEvent: boolean };
  workflows: string[];
  skills: SkillInfo[];
  workflowSkillMap: Record<string, string>;
  methods: string[];
  agentControlParams: string[];
  models: ModelInfo[];
  tools: ToolInfo[];
  hookEvents: string[];
  ui: { enabled: boolean; path: string };
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

// ── Bridge methods ─────────────────────────────────────────────────────────

export interface PingResult {
  pong: boolean;
  ts: string;
}

export interface NegotiateVersionParams {
  supportedVersions: string[];
}

export interface NegotiateVersionResult {
  negotiatedVersion: string;
  capabilities: CapabilitiesResult;
}

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export interface SetLogLevelParams {
  level: LogLevel;
}

export interface SetLogLevelResult {
  level: string;
}

export interface RuntimeInfo {
  bridgeVersion: string;
  apiVersion: string;
  transport: string;
  authMode: string;
  logLevel: string;
  sessionsPath: string;
  keysPath: string;
  specDrivenScriptPath: string;
  http: { port: number; corsOrigins: string } | null;
  nodeVersion: string;
}

// ── Session methods ────────────────────────────────────────────────────────

export type PermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "approve";

export interface ProxyParams {
  http?: string;
  https?: string;
  noProxy?: string;
}

export interface SessionStartParams {
  workspace: string;
  prompt: string;
  model?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: PermissionMode;
  maxTurns?: number;
  systemPrompt?: string;
  stream?: boolean;
  proxy?: ProxyParams;
  options?: Record<string, unknown>;
}

export interface SessionResult {
  sessionId: string;
  status: "completed" | "stopped";
  result: unknown;
  usage: unknown | null;
}

export interface SessionResumeParams {
  sessionId: string;
  prompt: string;
  model?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: PermissionMode;
  maxTurns?: number;
  systemPrompt?: string;
  stream?: boolean;
  proxy?: ProxyParams;
  options?: Record<string, unknown>;
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

export interface SessionListParams {
  status?: "active" | "all";
}

export interface SessionListItem {
  sessionId: string;
  status: string;
  workspace: string;
  createdAt: string;
  updatedAt: string;
  prompt: string | null;
}

export interface SessionListResult {
  sessions: SessionListItem[];
}

export interface SessionHistoryParams {
  sessionId: string;
  offset?: number;
  limit?: number;
}

export interface SessionHistoryResult {
  sessionId: string;
  total: number;
  entries: SessionHistoryEntry[];
}

export interface SessionHistoryEntry {
  type: string;
  prompt?: string;
  message?: unknown;
}

export interface SessionEventsParams {
  sessionId: string;
  since?: number;
  limit?: number;
}

export interface BufferedEvent {
  seq: number;
  payload: Record<string, unknown>;
}

export interface SessionEventsResult {
  sessionId: string;
  events: BufferedEvent[];
  total: number;
}

export interface SessionExportParams {
  sessionId: string;
}

export interface SessionExportResult {
  id: string;
  workspace: string;
  sdkSessionId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  history: SessionHistoryEntry[];
  result: unknown | null;
}

export interface SessionDeleteParams {
  sessionId: string;
}

export interface SessionDeleteResult {
  deleted: boolean;
  sessionId: string;
}

export interface SessionCleanupParams {
  olderThanDays?: number;
}

export interface SessionCleanupResult {
  removedCount: number;
}

export interface SessionApproveToolParams {
  sessionId: string;
  requestId: string;
}

export interface SessionRejectToolParams {
  sessionId: string;
  requestId: string;
  message?: string;
}

export interface ApprovalResult {
  requestId: string;
  behavior: "allow" | "deny";
}

export interface SessionBranchParams {
  sessionId: string;
  fromIndex?: number;
  prompt?: string;
}

export interface SessionSearchParams {
  query: string;
  workspace?: string;
  status?: string;
  limit?: number;
}

export interface SearchResult {
  sessionId: string;
  workspace: string;
  status: string;
  matches: Array<{ historyIndex: number; snippet: string }>;
}

export interface SessionSearchResult {
  results: SearchResult[];
}

// ── Workflow methods ───────────────────────────────────────────────────────

export type WorkflowName =
  | "init"
  | "propose"
  | "modify"
  | "apply"
  | "verify"
  | "archive"
  | "cancel"
  | "list"
  | "maintenance"
  | "migrate";

export interface WorkflowRunParams {
  workspace: string;
  workflow: WorkflowName;
  args?: string[];
}

export interface WorkflowRunResult {
  workflow: string;
  workspace: string;
  stdout: string;
  stderr: string;
  parsed: unknown | null;
}

// ── Model / Tool / Workspace methods ───────────────────────────────────────

export interface ModelsListResult {
  models: ModelInfo[];
}

export interface ToolsListResult {
  tools: ToolInfo[];
}

export interface WorkspaceRegisterParams {
  workspace: string;
}

export interface WorkspaceListResult {
  workspaces: unknown[];
}

// ── MCP methods ────────────────────────────────────────────────────────────

export interface McpAddParams {
  workspace: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpRemoveParams {
  workspace: string;
  name: string;
}

export interface McpStartParams {
  workspace: string;
  name: string;
}

export interface McpStopParams {
  workspace: string;
  name: string;
}

export interface McpListParams {
  workspace: string;
}

export interface McpEntry {
  name: string;
  status: string;
  pid: number | null;
}

export interface McpListResult {
  servers: McpEntry[];
}

// ── Config methods ─────────────────────────────────────────────────────────

export interface ConfigGetParams {
  key: string;
  workspace?: string;
}

export interface ConfigSetParams {
  key: string;
  value: unknown;
  scope: "project" | "user";
  workspace?: string;
}

export interface ConfigListParams {
  workspace?: string;
}

export interface ConfigEntry {
  key: string;
  value: unknown;
  scope: string;
}

export interface ConfigListResult {
  settings: ConfigEntry[];
}

// ── Hooks methods ──────────────────────────────────────────────────────────

export type HookEvent = "pre_tool_use" | "post_tool_use" | "notification" | "stop" | "subagent_stop";

export interface HooksAddParams {
  event: HookEvent;
  command: string;
  matcher?: string;
  scope: "project" | "user";
  workspace?: string;
}

export interface HooksRemoveParams {
  hookId: string;
}

export interface HooksListParams {
  workspace?: string;
}

export interface HookEntry {
  hookId: string;
  event: string;
  command: string;
  matcher?: string;
  scope: string;
  workspace?: string;
}

export interface HooksListResult {
  hooks: HookEntry[];
}

// ── Context methods ────────────────────────────────────────────────────────

export interface ContextReadParams {
  scope: "project" | "user";
  path: string;
  workspace?: string;
}

export interface ContextWriteParams {
  scope: "project" | "user";
  path: string;
  content: string;
  workspace?: string;
}

export interface ContextListParams {
  workspace?: string;
}

export interface ContextListResult {
  files: unknown[];
}

// ── Notifications ──────────────────────────────────────────────────────────

export type NotificationMethod =
  | "bridge/progress"
  | "bridge/session_event"
  | "bridge/hook_triggered"
  | "bridge/file_changed"
  | "bridge/tool_approval_requested";

export type SessionEventType =
  | "session_started"
  | "session_resumed"
  | "session_completed"
  | "session_stopped"
  | "agent_message";

export interface SessionEventNotification {
  sessionId: string;
  type: SessionEventType;
  requestId?: string | number | null;
  messageType?: string;
  message?: unknown;
  result?: unknown;
  usage?: unknown;
  status?: string;
}

export interface ProgressNotification {
  phase: "workflow_started" | "workflow_completed" | "workflow_failed";
  workflow?: string;
  workspace?: string;
  requestId?: string | number | null;
}

export interface ToolApprovalNotification {
  sessionId: string;
  requestId: string;
  toolName: string;
  input: Record<string, unknown>;
  title?: string;
  displayName?: string;
  description?: string;
}

export interface FileChangedNotification {
  sessionId: string;
  path: string;
  action: "created" | "modified";
}
