import { getTokenStore } from "../token-tracking/store.js";
import { getBudgetRegistry } from "./registry.js";
import type { BudgetPool, BudgetAlertPayload, BudgetEnforceResult, BudgetStatus } from "./types.js";

export interface BudgetEnforcerOptions {
  onAlert?: (alert: BudgetAlertPayload) => void;
  onThrottle?: (sessionId: string) => void;
}

function resolveConsumed(pool: BudgetPool, sessionId: string, providerId?: string): number {
  const store = getTokenStore();
  switch (pool.scope) {
    case "session": {
      const summary = store.getSessionUsage(sessionId);
      return summary?.totalTokens ?? 0;
    }
    case "provider": {
      if (!pool.scopeId) return 0;
      const providers = store.getProviderUsage(pool.scopeId);
      return providers.length > 0 ? providers[0].totalTokens : 0;
    }
    case "global": {
      const allProviders = store.getProviderUsage();
      let total = 0;
      for (const p of allProviders) total += p.totalTokens;
      return total;
    }
  }
}

function buildAlert(
  pool: BudgetPool,
  consumed: number,
  sessionId: string,
  threshold: number | null,
): BudgetAlertPayload {
  const remaining = Math.max(0, pool.allocated - consumed);
  const percentage = pool.allocated > 0 ? consumed / pool.allocated : 0;
  return {
    budgetId: pool.budgetId,
    scope: pool.scope,
    scopeId: pool.scopeId ?? null,
    allocated: pool.allocated,
    consumed,
    remaining,
    percentage,
    threshold,
    depletionAction: consumed >= pool.allocated ? pool.depletionAction : null,
    sessionId,
  };
}

export function preQueryBudgetCheck(
  sessionId: string,
  providerId?: string,
  options: BudgetEnforcerOptions = {},
): BudgetEnforceResult {
  const registry = getBudgetRegistry();
  const matchingPools = registry.getMatchingPools(sessionId, providerId);

  if (matchingPools.length === 0) {
    return { allowed: true, alerts: [] };
  }

  const alerts: BudgetAlertPayload[] = [];
  let blocked = false;

  for (const pool of matchingPools) {
    const consumed = resolveConsumed(pool, sessionId, providerId);
    if (consumed < pool.allocated) continue;

    // Budget is exhausted
    const alert = buildAlert(pool, consumed, sessionId, null);
    alerts.push(alert);
    options.onAlert?.(alert);

    if (pool.depletionAction === "block") {
      blocked = true;
    } else if (pool.depletionAction === "throttle") {
      options.onThrottle?.(sessionId);
    }
    // "notify" — alert already emitted, query proceeds
  }

  return { allowed: !blocked, alerts };
}

export function postQueryBudgetCheck(
  sessionId: string,
  providerId?: string,
  options: BudgetEnforcerOptions = {},
): BudgetAlertPayload[] {
  const registry = getBudgetRegistry();
  const matchingPools = registry.getMatchingPools(sessionId, providerId);

  const alerts: BudgetAlertPayload[] = [];

  for (const pool of matchingPools) {
    const consumed = resolveConsumed(pool, sessionId, providerId);
    const percentage = pool.allocated > 0 ? consumed / pool.allocated : 0;

    for (const threshold of pool.thresholds) {
      if (percentage < threshold) continue;
      if (registry.isThresholdTriggered(pool.budgetId, threshold)) continue;

      registry.recordTriggeredThreshold(pool.budgetId, threshold);
      const alert = buildAlert(pool, consumed, sessionId, threshold);
      alerts.push(alert);
      options.onAlert?.(alert);
    }

    // Also check depletion
    if (consumed >= pool.allocated) {
      const alert = buildAlert(pool, consumed, sessionId, null);
      alerts.push(alert);
      options.onAlert?.(alert);
    }
  }

  return alerts;
}

export function buildBudgetStatuses(
  pools: BudgetPool[],
  sessionId: string,
  providerId?: string,
): BudgetStatus[] {
  const registry = getBudgetRegistry();
  return pools.map((pool) => {
    const consumed = resolveConsumed(pool, sessionId, providerId);
    const remaining = Math.max(0, pool.allocated - consumed);
    const percentage = pool.allocated > 0 ? consumed / pool.allocated : 0;
    return {
      budgetId: pool.budgetId,
      scope: pool.scope,
      scopeId: pool.scopeId,
      allocated: pool.allocated,
      consumed,
      remaining,
      percentage,
      triggeredThresholds: registry.getTriggeredThresholds(pool.budgetId),
    };
  });
}
