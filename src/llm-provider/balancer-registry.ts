import { ConfigStore } from "../config-store.js";
import { LoadBalancer } from "./load-balancer.js";
import type { BalancerConfig, BalancerStatus } from "./types.js";

class BalancerRegistryError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "BalancerRegistryError";
  }
}

export class BalancerRegistry {
  private balancers: Map<string, LoadBalancer> = new Map();
  private configs: Map<string, BalancerConfig> = new Map();
  private configStore: ConfigStore;
  private knownProviderIds: Set<string>;

  private onExcluded?: (balancerId: string, providerId: string, reason: string, excludedUntil: string) => void;
  private onReadmitted?: (balancerId: string, providerId: string) => void;

  constructor(
    configStore?: ConfigStore,
    options?: {
      skipLoadFromStore?: boolean;
      knownProviderIds?: Set<string>;
      onExcluded?: (balancerId: string, providerId: string, reason: string, excludedUntil: string) => void;
      onReadmitted?: (balancerId: string, providerId: string) => void;
    },
  ) {
    this.configStore = configStore ?? new ConfigStore();
    this.knownProviderIds = options?.knownProviderIds ?? new Set();
    this.onExcluded = options?.onExcluded;
    this.onReadmitted = options?.onReadmitted;

    if (!options?.skipLoadFromStore) {
      this.loadFromStore();
    }
  }

  setKnownProviderIds(ids: Set<string>): void {
    this.knownProviderIds = ids;
  }

  setEventCallbacks(callbacks: {
    onExcluded: (balancerId: string, providerId: string, reason: string, excludedUntil: string) => void;
    onReadmitted: (balancerId: string, providerId: string) => void;
  }): void {
    // Closures in _createLoadBalancer reference this.onExcluded/onReadmitted dynamically,
    // so existing LoadBalancer instances pick up the new callbacks automatically.
    this.onExcluded = callbacks.onExcluded;
    this.onReadmitted = callbacks.onReadmitted;
  }

  create(config: BalancerConfig): { success: true; balancerId: string } {
    if (this.balancers.has(config.id)) {
      throw new BalancerRegistryError("DUPLICATE_ID", `Balancer already exists: ${config.id}`);
    }

    if (!config.providerIds || config.providerIds.length === 0) {
      throw new BalancerRegistryError("INVALID_PARAMS", "providerIds must be a non-empty array");
    }

    for (const pid of config.providerIds) {
      if (!this.knownProviderIds.has(pid)) {
        throw new BalancerRegistryError("PROVIDER_NOT_FOUND", `Provider not found: ${pid}`);
      }
    }

    const normalizedConfig: BalancerConfig = { ...config };
    this.configs.set(config.id, normalizedConfig);

    const lb = this._createLoadBalancer(normalizedConfig);
    this.balancers.set(config.id, lb);

    this.saveToStore();
    return { success: true, balancerId: config.id };
  }

  private _createLoadBalancer(config: BalancerConfig): LoadBalancer {
    return new LoadBalancer(config, {
      onExcluded: (providerId, reason, excludedUntil) => {
        this.onExcluded?.(config.id, providerId, reason, excludedUntil);
      },
      onReadmitted: (providerId) => {
        this.onReadmitted?.(config.id, providerId);
      },
    });
  }

  remove(balancerId: string): { success: true; balancerId: string } {
    const lb = this.balancers.get(balancerId);
    if (!lb) {
      throw new BalancerRegistryError("NOT_FOUND", `Balancer not found: ${balancerId}`);
    }

    lb.destroy();
    this.balancers.delete(balancerId);
    this.configs.delete(balancerId);
    this.saveToStore();
    return { success: true, balancerId };
  }

  get(balancerId: string): LoadBalancer {
    const lb = this.balancers.get(balancerId);
    if (!lb) {
      throw new BalancerRegistryError("NOT_FOUND", `Balancer not found: ${balancerId}`);
    }
    return lb;
  }

  list(): Array<{ id: string; strategy: string; providerCount: number }> {
    return Array.from(this.configs.values()).map((cfg) => ({
      id: cfg.id,
      strategy: cfg.strategy,
      providerCount: cfg.providerIds.length,
    }));
  }

  status(balancerId: string): BalancerStatus {
    const lb = this.get(balancerId);
    return { balancerId, providers: lb.providerStatuses() };
  }

  /** Select next provider for routing; excludes the provider if it fails. */
  route(balancerId: string): string {
    const lb = this.get(balancerId);
    const next = lb.next();
    if (!next) {
      throw new BalancerRegistryError("ALL_EXCLUDED", `No healthy providers available in balancer: ${balancerId}`);
    }
    return next;
  }

  /** Reactively exclude a provider after a failure. */
  excludeProvider(balancerId: string, providerId: string, reason: string): void {
    const lb = this.balancers.get(balancerId);
    lb?.exclude(providerId, reason);
  }

  destroy(): void {
    for (const lb of this.balancers.values()) {
      lb.destroy();
    }
    this.balancers.clear();
    this.configs.clear();
  }

  private saveToStore(): void {
    try {
      const configsArray = Array.from(this.configs.values());
      this.configStore.set("llmBalancers", configsArray, { scope: "user" });
    } catch (error) {
      console.error("Failed to save balancer registry to store:", error);
    }
  }

  private loadFromStore(): void {
    try {
      const entry = this.configStore.get("llmBalancers");
      if (!entry || !entry.value || !Array.isArray(entry.value)) return;

      for (const item of entry.value as Array<Record<string, unknown>>) {
        if (
          item &&
          typeof item === "object" &&
          typeof item["id"] === "string" &&
          typeof item["strategy"] === "string" &&
          Array.isArray(item["providerIds"])
        ) {
          const config = item as unknown as BalancerConfig;
          this.configs.set(config.id, config);
          const lb = this._createLoadBalancer(config);
          this.balancers.set(config.id, lb);
        }
      }
    } catch (error) {
      console.error("Failed to load balancer registry from store:", error);
    }
  }
}

export const balancerRegistry = new BalancerRegistry();
