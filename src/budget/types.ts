export type BudgetScope = "session" | "provider" | "global";

export type DepletionAction = "block" | "throttle" | "notify";

export interface BudgetPool {
  budgetId: string;
  scope: BudgetScope;
  scopeId?: string;
  allocated: number;
  thresholds: number[];
  depletionAction: DepletionAction;
}

export interface BudgetStatus {
  budgetId: string;
  scope: BudgetScope;
  scopeId?: string;
  allocated: number;
  consumed: number;
  remaining: number;
  percentage: number;
  triggeredThresholds: number[];
}

export interface BudgetAlertPayload {
  budgetId: string;
  scope: BudgetScope;
  scopeId: string | null;
  allocated: number;
  consumed: number;
  remaining: number;
  percentage: number;
  threshold: number | null;
  depletionAction: DepletionAction | null;
  sessionId: string;
}

export interface BudgetEnforceResult {
  allowed: boolean;
  alerts: BudgetAlertPayload[];
}

const VALID_SCOPES: ReadonlySet<string> = new Set(["session", "provider", "global"]);
const VALID_DEPLETION_ACTIONS: ReadonlySet<string> = new Set(["block", "throttle", "notify"]);
const DEFAULT_THRESHOLDS = [0.8];
const DEFAULT_DEPLETION_ACTION: DepletionAction = "notify";

export function validateBudgetPool(raw: Record<string, unknown>): BudgetPool | null {
  if (typeof raw["budgetId"] !== "string" || raw["budgetId"].length === 0) return null;

  const scope = raw["scope"];
  if (typeof scope !== "string" || !VALID_SCOPES.has(scope)) return null;

  if (scope !== "global") {
    if (typeof raw["scopeId"] !== "string" || raw["scopeId"].length === 0) return null;
  }

  const allocated = raw["allocated"];
  if (typeof allocated !== "number" || !Number.isInteger(allocated) || allocated <= 0) return null;

  let thresholds: number[];
  if (raw["thresholds"] === undefined) {
    thresholds = [...DEFAULT_THRESHOLDS];
  } else if (
    !Array.isArray(raw["thresholds"]) ||
    !(raw["thresholds"] as unknown[]).every((t) => typeof t === "number" && t > 0 && t < 1)
  ) {
    return null;
  } else {
    thresholds = [...(raw["thresholds"] as number[])].sort((a, b) => a - b);
  }

  let depletionAction: DepletionAction;
  if (raw["depletionAction"] === undefined) {
    depletionAction = DEFAULT_DEPLETION_ACTION;
  } else if (
    typeof raw["depletionAction"] !== "string" ||
    !VALID_DEPLETION_ACTIONS.has(raw["depletionAction"])
  ) {
    return null;
  } else {
    depletionAction = raw["depletionAction"] as DepletionAction;
  }

  return {
    budgetId: raw["budgetId"],
    scope: scope as BudgetScope,
    ...(scope !== "global" ? { scopeId: raw["scopeId"] as string } : {}),
    allocated,
    thresholds,
    depletionAction,
  };
}
