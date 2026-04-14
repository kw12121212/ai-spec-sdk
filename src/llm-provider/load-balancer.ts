import type { BalancerConfig, BalancerProviderStatus } from "./types.js";

const DEFAULT_COOL_DOWN_MS = 30_000;

interface ExclusionRecord {
  excludedUntil: number;
  reason: string;
}

export class LoadBalancer {
  readonly id: string;
  readonly strategy: "round-robin" | "weighted";
  readonly providerIds: string[];
  readonly weights: number[];
  readonly coolDownMs: number;

  private exclusions: Map<string, ExclusionRecord> = new Map();
  private rrIndex: number = 0;
  private admitTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  private onExcluded?: (providerId: string, reason: string, excludedUntil: string) => void;
  private onReadmitted?: (providerId: string) => void;

  constructor(
    config: BalancerConfig,
    callbacks?: {
      onExcluded?: (providerId: string, reason: string, excludedUntil: string) => void;
      onReadmitted?: (providerId: string) => void;
    },
  ) {
    this.id = config.id;
    this.strategy = config.strategy;
    this.providerIds = [...config.providerIds];
    this.coolDownMs = config.coolDownMs ?? DEFAULT_COOL_DOWN_MS;
    this.onExcluded = callbacks?.onExcluded;
    this.onReadmitted = callbacks?.onReadmitted;

    if (config.weights && config.weights.length === config.providerIds.length) {
      this.weights = [...config.weights];
    } else {
      this.weights = config.providerIds.map(() => 1);
    }
  }

  /** Return the next eligible provider ID, or null if all are excluded. */
  next(): string | null {
    const eligible = this.providerIds.filter((id) => !this.isExcluded(id));
    if (eligible.length === 0) return null;

    if (this.strategy === "weighted") {
      return this._weightedSelect(eligible);
    }

    // round-robin over eligible providers
    const n = this.providerIds.length;
    for (let attempt = 0; attempt < n; attempt++) {
      const idx = this.rrIndex % n;
      this.rrIndex = (this.rrIndex + 1) % n;
      const candidate = this.providerIds[idx];
      if (!this.isExcluded(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  private _weightedSelect(eligible: string[]): string {
    const eligibleWeights = eligible.map((id) => {
      const idx = this.providerIds.indexOf(id);
      return this.weights[idx] ?? 1;
    });
    const total = eligibleWeights.reduce((s, w) => s + w, 0);
    let rand = Math.random() * total;
    for (let i = 0; i < eligible.length; i++) {
      rand -= eligibleWeights[i];
      if (rand <= 0) return eligible[i];
    }
    return eligible[eligible.length - 1];
  }

  /** Reactively exclude a provider after a live-request failure. */
  exclude(providerId: string, reason: string): void {
    if (!this.providerIds.includes(providerId)) return;

    const existing = this.admitTimers.get(providerId);
    if (existing) clearTimeout(existing);

    const excludedUntil = Date.now() + this.coolDownMs;
    this.exclusions.set(providerId, { excludedUntil, reason });

    const isoUntil = new Date(excludedUntil).toISOString();
    this.onExcluded?.(providerId, reason, isoUntil);

    const timer = setTimeout(() => {
      this.exclusions.delete(providerId);
      this.admitTimers.delete(providerId);
      this.onReadmitted?.(providerId);
    }, this.coolDownMs);

    // Allow the process to exit even if the timer is pending
    if (typeof timer.unref === "function") timer.unref();

    this.admitTimers.set(providerId, timer);
  }

  isExcluded(providerId: string): boolean {
    const record = this.exclusions.get(providerId);
    if (!record) return false;
    if (Date.now() >= record.excludedUntil) {
      this.exclusions.delete(providerId);
      return false;
    }
    return true;
  }

  providerStatuses(): BalancerProviderStatus[] {
    return this.providerIds.map((id) => {
      const record = this.exclusions.get(id);
      if (record && Date.now() < record.excludedUntil) {
        return {
          providerId: id,
          excluded: true,
          excludedUntil: new Date(record.excludedUntil).toISOString(),
        };
      }
      return { providerId: id, excluded: false };
    });
  }

  destroy(): void {
    for (const timer of this.admitTimers.values()) {
      clearTimeout(timer);
    }
    this.admitTimers.clear();
    this.exclusions.clear();
  }
}
