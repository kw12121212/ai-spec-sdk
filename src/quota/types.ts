export type QuotaScope = "session" | "provider" | "global";

export type QuotaAction = "warn" | "block" | "warn+block";

export type QuotaRuleStatus = "ok" | "warning" | "exceeded";

export interface QuotaRule {
  quotaId: string;
  scope: QuotaScope;
  scopeId?: string;
  limit: number;
  action: QuotaAction;
  warnThreshold: number;
}

export interface QuotaStatus {
  quotaId: string;
  scope: QuotaScope;
  scopeId?: string;
  limit: number;
  action: QuotaAction;
  warnThreshold: number;
  currentUsage: number;
  percentage: number;
  status: QuotaRuleStatus;
}

export interface QuotaViolation {
  violationId: string;
  quotaId: string;
  sessionId: string;
  providerId: string;
  timestamp: number;
  usageAtViolation: number;
  limit: number;
  action: QuotaAction;
  blocked: boolean;
}

export interface QuotaEnforceResult {
  allowed: boolean;
  warnings: QuotaWarning[];
  violation?: QuotaViolation;
}

export interface QuotaWarning {
  quotaId: string;
  scope: QuotaScope;
  scopeId?: string;
  limit: number;
  currentUsage: number;
  percentage: number;
  sessionId: string;
}

export interface QuotaNotificationPayload {
  quotaId: string;
  scope: QuotaScope;
  scopeId: string | null;
  limit: number;
  currentUsage: number;
  percentage: number;
  sessionId: string;
}

export interface QuotaBlockedNotification extends QuotaNotificationPayload {
  violationId: string;
}

const VALID_SCOPES: ReadonlySet<string> = new Set(["session", "provider", "global"]);
const VALID_ACTIONS: ReadonlySet<string> = new Set(["warn", "block", "warn+block"]);
const DEFAULT_WARN_THRESHOLD = 0.8;

export function validateQuotaRule(raw: Record<string, unknown>): QuotaRule | null {
  if (typeof raw["quotaId"] !== "string" || raw["quotaId"].length === 0) return null;

  const scope = raw["scope"];
  if (typeof scope !== "string" || !VALID_SCOPES.has(scope)) return null;

  if (scope !== "global") {
    if (typeof raw["scopeId"] !== "string" || raw["scopeId"].length === 0) return null;
  }

  const limit = raw["limit"];
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit <= 0) return null;

  const action = raw["action"];
  if (typeof action !== "string" || !VALID_ACTIONS.has(action)) return null;

  let warnThreshold = raw["warnThreshold"];
  if (warnThreshold === undefined) {
    warnThreshold = DEFAULT_WARN_THRESHOLD;
  } else if (typeof warnThreshold !== "number" || warnThreshold < 0 || warnThreshold > 1) {
    return null;
  }

  return {
    quotaId: raw["quotaId"],
    scope: scope as QuotaScope,
    ...(scope !== "global" ? { scopeId: raw["scopeId"] as string } : {}),
    limit,
    action: action as QuotaAction,
    warnThreshold: warnThreshold as number,
  };
}

export function computeQuotaStatus(currentUsage: number, limit: number, warnThreshold: number): QuotaRuleStatus {
  if (currentUsage >= limit) return "exceeded";
  if (currentUsage >= limit * warnThreshold) return "warning";
  return "ok";
}

export function generateViolationId(): string {
  return `qv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
