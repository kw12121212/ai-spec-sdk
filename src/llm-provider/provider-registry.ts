import { ConfigStore } from "../config-store.js";
import type { LLMProvider, ProviderConfig } from "./types.js";
import { AnthropicAdapter } from "./adapters/anthropic.js";

type ProviderAdapterFactory = (config: ProviderConfig) => LLMProvider;

const SUPPORTED_TYPES = ["anthropic", "openai", "local"] as const;

type SupportedType = (typeof SUPPORTED_TYPES)[number];

interface ValidationError {
  field: string;
  message: string;
}

class ProviderRegistryError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "ProviderRegistryError";
  }
}

export class ProviderRegistry {
  private configs: Map<string, ProviderConfig> = new Map();
  private instances: Map<string, LLMProvider> = new Map();
  private defaultProviderId: string | null = null;
  private adapterFactories: Record<string, ProviderAdapterFactory> = {};
  private configStore: ConfigStore;

  constructor(configStore?: ConfigStore, options?: { skipLoadFromStore?: boolean }) {
    this.configStore = configStore ?? new ConfigStore();
    this.registerDefaultAdapters();
    if (!options?.skipLoadFromStore) {
      this.loadFromStore();
    }
  }

  private registerDefaultAdapters(): void {
    this.adapterFactories["anthropic"] = (config) => new AnthropicAdapter(config);
  }

  validateConfig(config: unknown): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!config || typeof config !== "object" || Array.isArray(config)) {
      errors.push({ field: "config", message: "must be an object" });
      return errors;
    }

    const cfg = config as Partial<ProviderConfig>;

    if (!cfg.id || typeof cfg.id !== "string" || cfg.id.trim() === "") {
      errors.push({ field: "id", message: "must be a non-empty string" });
    }

    if (!cfg.type || typeof cfg.type !== "string") {
      errors.push({ field: "type", message: "must be a string" });
    } else if (!SUPPORTED_TYPES.includes(cfg.type as SupportedType)) {
      errors.push({
        field: "type",
        message: `must be one of: ${SUPPORTED_TYPES.join(", ")}`,
      });
    }

    if (cfg.type === "anthropic" || cfg.type === "openai") {
      const hasApiKey = cfg.apiKey && typeof cfg.apiKey === "string" && cfg.apiKey.trim() !== "";
      const envVarName = cfg.type === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
      const hasEnvKey = typeof process.env[envVarName] === "string" && process.env[envVarName]!.trim() !== "";

      if (!hasApiKey && !hasEnvKey) {
        errors.push({
          field: "apiKey",
          message: `required for type '${cfg.type}' (set in config or ${envVarName} environment variable)`,
        });
      }
    }

    return errors;
  }

  register(config: ProviderConfig): { success: true; providerId: string } {
    const errors = this.validateConfig(config);
    if (errors.length > 0) {
      throw new ProviderRegistryError(
        "VALIDATION_ERROR",
        `Invalid configuration: ${errors.map((e) => `${e.field}: ${e.message}`).join("; ")}`
      );
    }

    if (this.configs.has(config.id)) {
      throw new ProviderRegistryError(
        "DUPLICATE_ID",
        `Provider with ID '${config.id}' already exists`
      );
    }

    if (!(config.type in this.adapterFactories)) {
      throw new ProviderRegistryError(
        "UNSUPPORTED_TYPE",
        `Unsupported provider type: ${config.type}`
      );
    }

    this.configs.set(config.id, { ...config });
    this.saveToStore();

    return { success: true, providerId: config.id };
  }

  list(): ProviderConfig[] {
    return Array.from(this.configs.values()).map((config) => this.maskSensitiveFields(config));
  }

  get(providerId: string): ProviderConfig {
    const config = this.configs.get(providerId);
    if (!config) {
      throw new ProviderRegistryError("NOT_FOUND", `Provider not found: ${providerId}`);
    }
    return this.maskSensitiveFields(config);
  }

  update(providerId: string, updates: Partial<ProviderConfig>): ProviderConfig {
    const existing = this.configs.get(providerId);
    if (!existing) {
      throw new ProviderRegistryError("NOT_FOUND", `Provider not found: ${providerId}`);
    }

    const mergedConfig: ProviderConfig = { ...existing, ...updates, id: providerId };

    const errors = this.validateConfig(mergedConfig);
    if (errors.length > 0) {
      throw new ProviderRegistryError(
        "VALIDATION_ERROR",
        `Invalid configuration: ${errors.map((e) => `${e.field}: ${e.message}`).join("; ")}`
      );
    }

    if (this.instances.has(providerId)) {
      const instance = this.instances.get(providerId)!;
      instance.destroy();
      this.instances.delete(providerId);
    }

    this.configs.set(providerId, mergedConfig);
    this.saveToStore();

    return this.maskSensitiveFields(mergedConfig);
  }

  remove(providerId: string): { success: true; providerId: string } {
    if (!this.configs.has(providerId)) {
      throw new ProviderRegistryError("NOT_FOUND", `Provider not found: ${providerId}`);
    }

    if (this.instances.has(providerId)) {
      const instance = this.instances.get(providerId)!;
      instance.destroy();
      this.instances.delete(providerId);
    }

    this.configs.delete(providerId);

    if (this.defaultProviderId === providerId) {
      this.defaultProviderId = null;
    }

    this.saveToStore();

    return { success: true, providerId };
  }

  setDefault(providerId: string): { success: true; providerId: string } {
    if (!this.configs.has(providerId)) {
      throw new ProviderRegistryError("NOT_FOUND", `Provider not found: ${providerId}`);
    }

    this.defaultProviderId = providerId;

    return { success: true, providerId };
  }

  getDefault(): { providerId: string | null; config?: ProviderConfig } {
    if (!this.defaultProviderId) {
      return { providerId: null };
    }

    const config = this.configs.get(this.defaultProviderId);
    return {
      providerId: this.defaultProviderId,
      config: config ? this.maskSensitiveFields(config) : undefined,
    };
  }

  async healthCheck(providerId: string): Promise<{ healthy: boolean; providerId: string; error?: string }> {
    if (!this.configs.has(providerId)) {
      throw new ProviderRegistryError("NOT_FOUND", `Provider not found: ${providerId}`);
    }

    try {
      const instance = await this.getOrCreateInstance(providerId);
      const isHealthy = await instance.healthCheck();

      return { healthy: isHealthy, providerId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { healthy: false, providerId, error: message };
    }
  }

  private async getOrCreateInstance(providerId: string): Promise<LLMProvider> {
    const cached = this.instances.get(providerId);
    if (cached) {
      return cached;
    }

    const config = this.configs.get(providerId);
    if (!config) {
      throw new ProviderRegistryError("NOT_FOUND", `Provider not found: ${providerId}`);
    }

    const factory = this.adapterFactories[config.type];
    if (!factory) {
      throw new ProviderRegistryError(
        "UNSUPPORTED_TYPE",
        `No adapter factory for type: ${config.type}`
      );
    }

    const instance = factory(config);
    await instance.initialize();

    this.instances.set(providerId, instance);

    return instance;
  }

  private maskSensitiveFields(config: ProviderConfig): ProviderConfig {
    const masked = { ...config };

    if (masked.apiKey && typeof masked.apiKey === "string" && masked.apiKey.length > 8) {
      masked.apiKey = `${masked.apiKey.substring(0, 7)}...`;
    }

    return masked;
  }

  private saveToStore(): void {
    try {
      const configsArray = Array.from(this.configs.entries()).map(([, config]) => ({
        ...config,
      }));

      this.configStore.set("llmProviders", configsArray, { scope: "user" });
    } catch (error) {
      console.error("Failed to save provider registry to store:", error);
    }
  }

  private loadFromStore(): void {
    try {
      const entry = this.configStore.get("llmProviders");
      if (!entry || !entry.value || !Array.isArray(entry.value)) {
        return;
      }

      const configsArray = entry.value as Array<Record<string, unknown>>;

      for (const item of configsArray) {
        if (
          item &&
          typeof item === "object" &&
          typeof item.id === "string" &&
          typeof item.type === "string"
        ) {
          const config = item as unknown as ProviderConfig;
          this.configs.set(config.id, config);
        }
      }
    } catch (error) {
      console.error("Failed to load provider registry from store:", error);
    }
  }

  destroy(): void {
    for (const [providerId, instance] of this.instances) {
      try {
        instance.destroy();
      } catch (error) {
        console.error(`Failed to destroy provider instance ${providerId}:`, error);
      }
    }
    this.instances.clear();
    this.configs.clear();
    this.defaultProviderId = null;
  }
}

export const providerRegistry = new ProviderRegistry();
