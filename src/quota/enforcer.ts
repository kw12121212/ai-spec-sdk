import { defaultLogger as logger } from "../logger.js";
import { getTokenStore } from "../token-tracking/store.js";
import { getQuotaRegistry } from "./registry.js";
import type {
  QuotaRule,
  QuotaEnforceResult,
  QuotaWarning,
  QuotaViolation,
  QuotaStatus,
} from "./types.js";
import { computeQuotaStatus, generateViolationId } from "./types.js";

export interface EnforcerOptions {
  onWarning?: (warning: QuotaWarning) => void;
  onBlocked?: (notification: import("./types.js").QuotaBlockedNotification) => void;
}

export type SessionGetter = (sessionId: string) => { teamId?: string } | undefined;
export type SessionListGetter = (options: { teamId?: string }) => Array<{ id: string; teamId?: string }>;

let getSession: SessionGetter = () => undefined;
let getSessionList: SessionListGetter = () => [];

export function setSessionAccessors(getter: SessionGetter, listGetter: SessionListGetter) {
  getSession = getter;
  getSessionList = listGetter;
}

function resolveUsage(rule: QuotaRule, sessionId: string, providerId?: string): number {
  const store = getTokenStore();
  switch (rule.scope) {
    case "session": {
      const summary = store.getSessionUsage(sessionId);
      return summary?.totalTokens ?? 0;
    }
    case "provider": {
      if (!rule.scopeId) return 0;
      const providers = store.getProviderUsage(rule.scopeId);
      return providers.length > 0 ? providers[0].totalTokens : 0;
    }
    case "global": {
      const allProviders = store.getProviderUsage();
      let total = 0;
      for (const p of allProviders) total += p.totalTokens;
      return total;
    }
    case "team": {
      if (!rule.scopeId) return 0;
      const teamSessions = getSessionList({ teamId: rule.scopeId });
      let total = 0;
      for (const session of teamSessions) {
        const usage = store.getSessionUsage(session.id);
        if (usage) {
          total += usage.totalTokens;
        }
      }
      return total;
    }
  }
}

export function preQueryCheck(
  sessionId: string,
  providerId?: string,
  options: EnforcerOptions = {},
): QuotaEnforceResult {
  const registry = getQuotaRegistry();
  const session = getSession(sessionId);
  const matchingRules = registry.getMatchingRules(sessionId, providerId, session?.teamId);

  if (matchingRules.length === 0) {
    return { allowed: true, warnings: [] };
  }

  const warnings: QuotaWarning[] = [];
  let blockViolation: QuotaViolation | undefined;

  for (const rule of matchingRules) {
    const currentUsage = resolveUsage(rule, sessionId, providerId);
    const percentage = currentUsage / rule.limit;
    const status = computeQuotaStatus(currentUsage, rule.limit, rule.warnThreshold);

    if (status === "exceeded" && (rule.action === "block" || rule.action === "warn+block")) {
      const violation = registry.recordViolation({
        quotaId: rule.quotaId,
        sessionId,
        providerId: providerId ?? "",
        timestamp: Date.now(),
        usageAtViolation: currentUsage,
        limit: rule.limit,
        action: rule.action,
        blocked: true,
      });
      blockViolation = violation;

      options.onBlocked?.({
        quotaId: rule.quotaId,
        scope: rule.scope,
        scopeId: rule.scopeId ?? null,
        limit: rule.limit,
        currentUsage,
        percentage,
        sessionId,
        violationId: violation.violationId,
      });
      break;
    }

    if (status === "warning" || status === "exceeded") {
      const warning: QuotaWarning = {
        quotaId: rule.quotaId,
        scope: rule.scope,
        scopeId: rule.scopeId,
        limit: rule.limit,
        currentUsage,
        percentage,
        sessionId,
      };
      warnings.push(warning);

      options.onWarning?.(warning);
    }
  }

  return {
    allowed: blockViolation === undefined,
    warnings,
    violation: blockViolation,
  };
}

export function postQueryCheck(
  sessionId: string,
  providerId?: string,
  options: EnforcerOptions = {},
): QuotaWarning[] {
  const registry = getQuotaRegistry();
  const session = getSession(sessionId);
  const matchingRules = registry.getMatchingRules(sessionId, providerId, session?.teamId);

  const warnings: QuotaWarning[] = [];

  for (const rule of matchingRules) {
    const currentUsage = resolveUsage(rule, sessionId, providerId);
    const percentage = currentUsage / rule.limit;
    const status = computeQuotaStatus(currentUsage, rule.limit, rule.warnThreshold);

    if (status === "warning" || status === "exceeded") {
      const warning: QuotaWarning = {
        quotaId: rule.quotaId,
        scope: rule.scope,
        scopeId: rule.scopeId,
        limit: rule.limit,
        currentUsage,
        percentage,
        sessionId,
      };
      warnings.push(warning);
      options.onWarning?.(warning);
    }
  }

  return warnings;
}

export function buildQuotaStatuses(rules: QuotaRule[], sessionId: string, providerId?: string): QuotaStatus[] {
  return rules.map((rule) => {
    const currentUsage = resolveUsage(rule, sessionId, providerId);
    const percentage = rule.limit > 0 ? currentUsage / rule.limit : 0;
    return {
      quotaId: rule.quotaId,
      scope: rule.scope,
      scopeId: rule.scopeId,
      limit: rule.limit,
      action: rule.action,
      warnThreshold: rule.warnThreshold,
      currentUsage,
      percentage,
      status: computeQuotaStatus(currentUsage, rule.limit, rule.warnThreshold),
    };
  });
}
