export const BRIDGE_VERSION = "0.1.0";

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
];

export const BUILTIN_SPEC_SKILLS: readonly string[] = [
  "spec-driven-brainstorm",
  "spec-driven-init",
  "spec-driven-propose",
  "spec-driven-modify",
  "spec-driven-spec-content",
  "spec-driven-apply",
  "spec-driven-verify",
  "spec-driven-review",
  "spec-driven-archive",
  "spec-driven-cancel",
  "spec-driven-auto",
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
};

export interface Capabilities {
  protocol: string;
  transport: string;
  bridgeVersion: string;
  notifications: { progress: boolean; sessionEvent: boolean };
  workflows: readonly string[];
  skills: readonly string[];
  workflowSkillMap: Readonly<Record<string, string>>;
  methods: string[];
  agentControlParams: readonly string[];
  models: readonly ModelInfo[];
  tools: readonly ToolInfo[];
  hookEvents: readonly string[];
}

export function getCapabilities(): Capabilities {
  return {
    protocol: "jsonrpc-2.0",
    transport: "stdio",
    bridgeVersion: BRIDGE_VERSION,
    notifications: {
      progress: true,
      sessionEvent: true,
    },
    workflows: SUPPORTED_WORKFLOWS,
    skills: BUILTIN_SPEC_SKILLS,
    workflowSkillMap: WORKFLOW_SKILL_MAP,
    methods: [
      "bridge.capabilities",
      "bridge.ping",
      "workflow.run",
      "skills.list",
      "session.start",
      "session.resume",
      "session.stop",
      "session.status",
      "session.list",
      "session.history",
      "session.events",
      "models.list",
      "workspace.register",
      "workspace.list",
      "tools.list",
      "session.approveTool",
      "session.rejectTool",
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
    ],
    agentControlParams: [
      "model",
      "allowedTools",
      "disallowedTools",
      "permissionMode",
      "maxTurns",
      "systemPrompt",
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
  };
}
