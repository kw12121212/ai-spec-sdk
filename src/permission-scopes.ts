export type ToolScope =
  | "file:read"
  | "file:write"
  | "network"
  | "system"
  | "task"
  | "notebook:read"
  | "notebook:write";

export const VALID_SCOPES: ReadonlySet<string> = new Set<string>([
  "file:read",
  "file:write",
  "network",
  "system",
  "task",
  "notebook:read",
  "notebook:write",
]);

export const TOOL_SCOPE_MAP: ReadonlyMap<string, readonly ToolScope[]> = new Map<
  string,
  readonly ToolScope[]
>([
  ["Read", ["file:read"]],
  ["Glob", ["file:read"]],
  ["Grep", ["file:read"]],
  ["LS", ["file:read"]],
  ["Write", ["file:write"]],
  ["Edit", ["file:write"]],
  ["MultiEdit", ["file:write"]],
  ["WebFetch", ["network"]],
  ["WebSearch", ["network"]],
  ["Bash", ["system"]],
  ["TodoRead", ["task"]],
  ["TodoWrite", ["task"]],
  ["NotebookRead", ["notebook:read"]],
  ["NotebookEdit", ["notebook:write"]],
]);

export function resolveScopes(toolName: string): readonly ToolScope[] {
  if (toolName.startsWith("custom.")) {
    return ["system"];
  }
  return TOOL_SCOPE_MAP.get(toolName) ?? ["system"];
}

export function getAllScopes(): readonly ToolScope[] {
  return [...VALID_SCOPES] as ToolScope[];
}

export function getToolMapping(): ReadonlyMap<string, readonly ToolScope[]> {
  return TOOL_SCOPE_MAP;
}

export interface ScopeConfig {
  allowedScopes?: string[];
  blockedScopes?: string[];
}

export function validateScopeStrings(
  scopes: string[],
  field: string,
): void {
  for (const s of scopes) {
    if (!VALID_SCOPES.has(s)) {
      throw new Error(
        `Invalid ${field} value '${s}'. Must be one of: ${[...VALID_SCOPES].join(", ")}`,
      );
    }
  }
}

export function isScopeDenied(
  toolName: string,
  config: ScopeConfig,
): { denied: false } | { denied: true; requiredScopes: readonly ToolScope[] } {
  if (config.allowedScopes === undefined && config.blockedScopes === undefined) {
    return { denied: false };
  }

  const requiredScopes = resolveScopes(toolName);

  // blockedScopes takes precedence
  if (config.blockedScopes !== undefined) {
    for (const scope of requiredScopes) {
      if (config.blockedScopes.includes(scope)) {
        return { denied: true, requiredScopes };
      }
    }
  }

  // allowedScopes: all required scopes must be in the allowed set
  if (config.allowedScopes !== undefined) {
    for (const scope of requiredScopes) {
      if (!config.allowedScopes.includes(scope)) {
        return { denied: true, requiredScopes };
      }
    }
  }

  return { denied: false };
}
