export const BRIDGE_VERSION = "0.1.0";

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
      "workflow.run",
      "skills.list",
      "session.start",
      "session.resume",
      "session.stop",
      "session.status",
      "session.list",
    ],
    agentControlParams: [
      "model",
      "allowedTools",
      "disallowedTools",
      "permissionMode",
      "maxTurns",
      "systemPrompt",
    ],
  };
}
