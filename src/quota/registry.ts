import type { QuotaRule, QuotaViolation } from "./types.js";
import { generateViolationId } from "./types.js";

class QuotaRegistry {
  private rules: Map<string, QuotaRule> = new Map();
  private violations: QuotaViolation[] = [];

  set(rule: QuotaRule): boolean {
    if (this.rules.has(rule.quotaId)) return false;
    this.rules.set(rule.quotaId, rule);
    return true;
  }

  get(quotaId: string): QuotaRule | null {
    return this.rules.get(quotaId) ?? null;
  }

  list(scope?: string): QuotaRule[] {
    const all = Array.from(this.rules.values());
    if (!scope) return all;
    return all.filter((r) => r.scope === scope);
  }

  remove(quotaId: string): boolean {
    return this.rules.delete(quotaId);
  }

  clear(): number {
    const count = this.rules.size;
    this.rules.clear();
    return count;
  }

  removeBySession(sessionId: string): number {
    let removed = 0;
    for (const [quotaId, rule] of this.rules) {
      if (rule.scope === "session" && rule.scopeId === sessionId) {
        this.rules.delete(quotaId);
        removed++;
      }
    }
    return removed;
  }

  getMatchingRules(sessionId: string, providerId?: string): QuotaRule[] {
    const matched: QuotaRule[] = [];
    for (const rule of this.rules.values()) {
      switch (rule.scope) {
        case "session":
          if (rule.scopeId === sessionId) matched.push(rule);
          break;
        case "provider":
          if (providerId && rule.scopeId === providerId) matched.push(rule);
          break;
        case "global":
          matched.push(rule);
          break;
      }
    }
    return matched;
  }

  recordViolation(violation: Omit<QuotaViolation, "violationId">): QuotaViolation {
    const full: QuotaViolation = {
      ...violation,
      violationId: generateViolationId(),
    };
    this.violations.push(full);
    return full;
  }

  getViolations(sessionId?: string): QuotaViolation[] {
    if (!sessionId) return [...this.violations].sort((a, b) => b.timestamp - a.timestamp);
    return this.violations.filter((v) => v.sessionId === sessionId).sort((a, b) => b.timestamp - a.timestamp);
  }

  clearViolations(): number {
    const count = this.violations.length;
    this.violations = [];
    return count;
  }

  get size(): number {
    return this.rules.size;
  }
}

let registryInstance: QuotaRegistry | null = null;

export function getQuotaRegistry(): QuotaRegistry {
  if (!registryInstance) {
    registryInstance = new QuotaRegistry();
  }
  return registryInstance;
}

export function setQuotaRegistry(registry: QuotaRegistry | null): void {
  registryInstance = registry;
}

export { QuotaRegistry };
