// AUTO-GENERATED from bridge-contract.yaml
// Do not edit manually. Run `bun run generate:types` to regenerate.
// Generated at: 2026-04-10T09:35:43.260Z

// ── Common ──────────────────────────────────────────────────────────────────

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
  error?: { code: number; message: string; data?: unknown };
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params: Record<string, unknown>;
}

// ── Method Params and Results ───────────────────────────────────────────────

export interface BridgeCapabilitiesResult {
  protocol: string;
  transport: "stdio" | "http";
  bridgeVersion: string;
  apiVersion: string;
  notifications: { progress: boolean; sessionEvent: boolean };
  workflows: "init" | "propose" | "modify" | "apply" | "verify" | "archive" | "cancel" | "list";
  skills: "spec-driven-brainstorm" | "spec-driven-init" | "spec-driven-propose" | "spec-driven-modify" | "spec-driven-spec-content" | "spec-driven-apply" | "spec-driven-verify" | "spec-driven-review" | "spec-driven-archive" | "spec-driven-cancel" | "spec-driven-auto";
  workflowSkillMap: Record<string, unknown>;
  methods: unknown[];
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

// ── Error Types ──────────────────────────────────────────────────────────────

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

// ── Notification Types ───────────────────────────────────────────────────────

export type NotificationMethod =
  ;
