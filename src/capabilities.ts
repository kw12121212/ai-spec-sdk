export const BRIDGE_VERSION = "0.2.0";
export const API_VERSION = BRIDGE_VERSION;

export interface ModelInfo {
  id: string;
  displayName: string;
}

export const SUPPORTED_MODELS: readonly ModelInfo[] = [
  { id: "claude-opus-4-6", displayName: "Claude Opus 4.6" },
  { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4-5-20251001", displayName: "Claude Haiku 4.5" },
  { id: "claude-opus-4-5", displayName: "Claude Opus 4.5" },
  { id: "claude-sonnet-4-5", displayName: "Claude Sonnet 4.5" },
  { id: "claude-opus-3-7-20250219", displayName: "Claude Opus 3.7" },
  { id: "claude-sonnet-3-7-20250219", displayName: "Claude Sonnet 3.7" },
  { id: "claude-haiku-3-5-20241022", displayName: "Claude Haiku 3.5" },
];

export interface ToolInfo {
  name: string;
  description: string;
}

export const BUILTIN_TOOLS: readonly ToolInfo[] = [
  { name: "Bash", description: "Execute shell commands" },
  { name: "Read", description: "Read file contents" },
  { name: "Write", description: "Write or create files" },
  { name: "Edit", description: "Make targeted edits to existing files" },
  { name: "MultiEdit", description: "Make multiple edits to a file in one operation" },
  { name: "Glob", description: "Find files by glob pattern" },
  { name: "Grep", description: "Search file contents with regex" },
  { name: "LS", description: "List directory contents" },
  { name: "WebFetch", description: "Fetch content from a URL" },
  { name: "WebSearch", description: "Search the web" },
  { name: "TodoRead", description: "Read the current task list" },
  { name: "TodoWrite", description: "Write or update the task list" },
  { name: "NotebookRead", description: "Read a Jupyter notebook" },
  { name: "NotebookEdit", description: "Edit a Jupyter notebook cell" },
];

export const SUPPORTED_WORKFLOWS: readonly string[] = [
  "init",
  "propose",
  "modify",
  "apply",
  "verify",
  "archive",
  "cancel",
  "list",
  "maintenance",
  "migrate",
];

export interface SkillInfo {
  name: string;
  description: string;
  hasScript: boolean;
  parameters: readonly string[];
}

export const BUILTIN_SPEC_SKILLS: readonly SkillInfo[] = [
  { name: "spec-driven-brainstorm", description: "Discuss a rough idea, converge on scope, and generate a proposal after confirmation", hasScript: false, parameters: [] },
  { name: "spec-driven-init", description: "Initialize .spec-driven/ in a project with config.yaml and specs scaffold", hasScript: true, parameters: ["[path]"] },
  { name: "spec-driven-propose", description: "Read existing specs and scaffold a new change with all five artifacts", hasScript: true, parameters: ["<name>"] },
  { name: "spec-driven-modify", description: "Edit an existing change artifact (proposal, specs, design, tasks, questions)", hasScript: true, parameters: ["[name]"] },
  { name: "spec-driven-spec-content", description: "Classify spec content and place it in the correct delta spec file", hasScript: false, parameters: [] },
  { name: "spec-driven-apply", description: "Implement tasks one by one and update delta specs when done", hasScript: true, parameters: ["<change>"] },
  { name: "spec-driven-verify", description: "Check task completion, implementation evidence, and spec alignment", hasScript: true, parameters: ["<name>"] },
  { name: "spec-driven-review", description: "Review a completed change for code quality before archive", hasScript: false, parameters: [] },
  { name: "spec-driven-archive", description: "Merge delta specs into specs/, update INDEX.md, and move to archive/", hasScript: true, parameters: ["<name>"] },
  { name: "spec-driven-cancel", description: "Permanently delete an in-progress change", hasScript: true, parameters: ["<name>"] },
  { name: "spec-driven-auto", description: "Run full workflow automatically with one confirmation checkpoint", hasScript: false, parameters: [] },
  { name: "spec-driven-maintenance", description: "Run automated maintenance: lint, test, typecheck, and auto-fix", hasScript: true, parameters: ["[path]"] },
];

export const WORKFLOW_SKILL_MAP: Readonly<Record<string, string>> = {
  init: "spec-driven-init",
  propose: "spec-driven-propose",
  modify: "spec-driven-modify",
  apply: "spec-driven-apply",
  verify: "spec-driven-verify",
  archive: "spec-driven-archive",
  cancel: "spec-driven-cancel",
  // "list" uses spec-driven-modify to enumerate active changes
  list: "spec-driven-modify",
  maintenance: "spec-driven-maintenance",
  migrate: "spec-driven-maintenance",
};

export interface Capabilities {
  protocol: string;
  transport: string;
  bridgeVersion: string;
  apiVersion: string;
  streaming: boolean;
  notifications: { progress: boolean; sessionEvent: boolean };
  workflows: readonly string[];
  skills: readonly SkillInfo[];
  workflowSkillMap: Readonly<Record<string, string>>;
  methods: string[];
  agentControlParams: readonly string[];
  models: readonly ModelInfo[];
  tools: readonly ToolInfo[];
  hookEvents: readonly string[];
  ui: { enabled: boolean; path: string };
}

export function getCapabilities(transport = "stdio"): Capabilities {
  return {
    protocol: "jsonrpc-2.0",
    transport,
    bridgeVersion: BRIDGE_VERSION,
    apiVersion: API_VERSION,
    streaming: true,
    notifications: {
      progress: true,
      sessionEvent: true,
    },
    workflows: SUPPORTED_WORKFLOWS,
    skills: BUILTIN_SPEC_SKILLS,
    workflowSkillMap: WORKFLOW_SKILL_MAP,
    methods: [
      "bridge.capabilities",
      "bridge.negotiateVersion",
      "bridge.ping",
      "bridge.info",
      "bridge.setLogLevel",
      "workflow.run",
      "skills.list",
      "session.start",
      "session.spawn",
      "session.resume",
      "session.pause",
      "session.stop",
      "session.cancel",
      "session.status",
      "session.list",
      "session.history",
      "session.events",
      "session.export",
      "session.delete",
      "session.cleanup",
      "session.approveTool",
      "session.rejectTool",
      "session.branch",
      "session.search",
      "session.setProvider",
      "provider.register",
      "provider.list",
      "provider.get",
      "provider.update",
      "provider.remove",
      "provider.setDefault",
      "provider.getDefault",
      "provider.healthCheck",
      "provider.switch",
      "models.list",
      "workspace.register",
      "workspace.list",
      "tools.list",
      "tools.register",
      "tools.unregister",
      "mcp.add",
      "mcp.remove",
      "mcp.start",
      "mcp.stop",
      "mcp.list",
      "config.get",
      "config.set",
      "config.list",
      "hooks.add",
      "hooks.remove",
      "hooks.list",
      "context.read",
      "context.write",
      "context.list",
      "webhook.subscribe",
      "webhook.unsubscribe",
      "template.create",
      "template.get",
      "template.list",
      "template.delete",
      "quota.set",
      "quota.get",
      "quota.list",
      "quota.remove",
      "quota.clear",
      "quota.getStatus",
      "quota.getViolations",
      "permissions.scopes",
    ],
    agentControlParams: [
      "model",
      "allowedTools",
      "disallowedTools",
      "permissionMode",
      "maxTurns",
      "systemPrompt",
      "timeoutMs",
    ],
    models: SUPPORTED_MODELS,
    tools: BUILTIN_TOOLS,
    hookEvents: [
      "pre_tool_use",
      "post_tool_use",
      "notification",
      "stop",
      "subagent_stop",
    ],
    ui: {
      enabled: transport === "http" && process.env["AI_SPEC_SDK_UI_ENABLED"] !== "false",
      path: "/",
    },
  };
}
