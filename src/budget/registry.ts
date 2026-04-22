import type { BudgetPool } from "./types.js";

class BudgetRegistry {
  private pools: Map<string, BudgetPool> = new Map();
  private triggeredThresholds: Map<string, Set<number>> = new Map();

  create(pool: BudgetPool): boolean {
    if (this.pools.has(pool.budgetId)) return false;
    this.pools.set(pool.budgetId, pool);
    this.triggeredThresholds.set(pool.budgetId, new Set());
    return true;
  }

  get(budgetId: string): BudgetPool | null {
    return this.pools.get(budgetId) ?? null;
  }

  list(scope?: string): BudgetPool[] {
    const all = Array.from(this.pools.values());
    if (!scope) return all;
    return all.filter((p) => p.scope === scope);
  }

  adjust(budgetId: string, newAllocated: number): BudgetPool | null {
    const pool = this.pools.get(budgetId);
    if (!pool) return null;
    pool.allocated = newAllocated;
    // Reset triggered thresholds so they can re-fire at the new allocation level
    this.triggeredThresholds.set(budgetId, new Set());
    return pool;
  }

  remove(budgetId: string): boolean {
    const deleted = this.pools.delete(budgetId);
    this.triggeredThresholds.delete(budgetId);
    return deleted;
  }

  removeBySession(sessionId: string): number {
    let removed = 0;
    for (const [budgetId, pool] of this.pools) {
      if (pool.scope === "session" && pool.scopeId === sessionId) {
        this.pools.delete(budgetId);
        this.triggeredThresholds.delete(budgetId);
        removed++;
      }
    }
    return removed;
  }

  getMatchingPools(sessionId: string, providerId?: string): BudgetPool[] {
    const matched: BudgetPool[] = [];
    for (const pool of this.pools.values()) {
      switch (pool.scope) {
        case "session":
          if (pool.scopeId === sessionId) matched.push(pool);
          break;
        case "provider":
          if (providerId && pool.scopeId === providerId) matched.push(pool);
          break;
        case "global":
          matched.push(pool);
          break;
      }
    }
    return matched;
  }

  recordTriggeredThreshold(budgetId: string, threshold: number): void {
    const set = this.triggeredThresholds.get(budgetId);
    if (set) set.add(threshold);
  }

  isThresholdTriggered(budgetId: string, threshold: number): boolean {
    return this.triggeredThresholds.get(budgetId)?.has(threshold) ?? false;
  }

  getTriggeredThresholds(budgetId: string): number[] {
    const set = this.triggeredThresholds.get(budgetId);
    return set ? Array.from(set).sort((a, b) => a - b) : [];
  }

  clear(): number {
    const count = this.pools.size;
    this.pools.clear();
    this.triggeredThresholds.clear();
    return count;
  }

  get size(): number {
    return this.pools.size;
  }
}

let registryInstance: BudgetRegistry | null = null;

export function getBudgetRegistry(): BudgetRegistry {
  if (!registryInstance) {
    registryInstance = new BudgetRegistry();
  }
  return registryInstance;
}

export function setBudgetRegistry(registry: BudgetRegistry | null): void {
  registryInstance = registry;
}

export { BudgetRegistry };
