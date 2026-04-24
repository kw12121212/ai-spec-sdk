import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { ProviderRegistry } from "../src/llm-provider/provider-registry.js";
import type { ProviderConfig } from "../src/llm-provider/types.js";

describe("ProviderRegistry", () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry(undefined, { skipLoadFromStore: true });
  });

  afterEach(() => {
    registry.destroy();
  });

  function createConfig(overrides?: Partial<ProviderConfig>): ProviderConfig {
    return {
      id: `test-provider-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type: "anthropic",
      apiKey: "sk-ant-test-key-1234567890",
      ...overrides,
    };
  }

  describe("register()", () => {
    it("should register a valid Anthropic provider with apiKey", () => {
      const config = createConfig();
      const result = registry.register(config);

      expect(result.success).toBe(true);
      expect(result.providerId).toBe(config.id);
    });

    it("should register with environment variable API key when config apiKey is not set", () => {
      const originalEnv = process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = "sk-ant-env-key-1234567890";

      try {
        const config = createConfig({ apiKey: undefined });
        const result = registry.register(config);

        expect(result.success).toBe(true);
        expect(result.providerId).toBe(config.id);
      } finally {
        if (originalEnv === undefined) {
          delete process.env.ANTHROPIC_API_KEY;
        } else {
          process.env.ANTHROPIC_API_KEY = originalEnv;
        }
      }
    });

    it("should reject duplicate provider ID", () => {
      const config = createConfig();
      registry.register(config);

      expect(() => {
        registry.register(config);
      }).toThrow("already exists");
    });

    it("should reject configurations missing id field", () => {
      const invalidConfig = { type: "anthropic" } as unknown as ProviderConfig;

      expect(() => {
        registry.register(invalidConfig);
      }).toThrow("Invalid configuration");
    });

    it("should reject configurations missing type field", () => {
      const invalidConfig = { id: "no-type" } as unknown as ProviderConfig;

      expect(() => {
        registry.register(invalidConfig);
      }).toThrow("Invalid configuration");
    });

    it("should reject unsupported provider type", () => {
      const invalidTypeConfig = {
        id: "unsupported",
        type: "invalid-type",
      } as unknown as ProviderConfig;

      expect(() => {
        registry.register(invalidTypeConfig);
      }).toThrow();
    });
  });

  describe("list()", () => {
    it("should return empty array when no providers registered", () => {
      const result = registry.list();

      expect(result).toEqual([]);
    });

    it("should return all registered providers", () => {
      const config1 = createConfig();
      const config2 = createConfig();

      registry.register(config1);
      registry.register(config2);

      const result = registry.list();

      expect(result).toHaveLength(2);
      expect(result.map((p) => p.id)).toContain(config1.id);
      expect(result.map((p) => p.id)).toContain(config2.id);
    });

    it("should mask API keys in list response", () => {
      const config = createConfig();
      registry.register(config);

      const result = registry.list();

      expect(result[0].apiKey).not.toBe("sk-ant-test-key-1234567890");
      expect(result[0].apiKey).toContain("...");
    });
  });

  describe("get()", () => {
    it("should return existing provider configuration", () => {
      const config = createConfig();
      registry.register(config);

      const result = registry.get(config.id);

      expect(result.id).toBe(config.id);
      expect(result.type).toBe("anthropic");
    });

    it("should throw when provider does not exist", () => {
      expect(() => {
        registry.get("non-existent");
      }).toThrow("not found");
    });

    it("should mask API key in get response", () => {
      const config = createConfig();
      registry.register(config);

      const result = registry.get(config.id);

      expect(result.apiKey).not.toBe("sk-ant-test-key-1234567890");
      expect(result.apiKey).toContain("...");
    });
  });

  describe("update()", () => {
    it("should update existing provider configuration", () => {
      const config = createConfig();
      registry.register(config);

      const result = registry.update(config.id, {
        model: "claude-opus-4-20250514",
      });

      expect(result.model).toBe("claude-opus-4-20250514");
      expect(result.id).toBe(config.id);
    });

    it("should throw when updating non-existent provider", () => {
      expect(() => {
        registry.update("non-existent", { model: "new-model" });
      }).toThrow("not found");
    });

    it("should destroy cached instance on update", async () => {
      const originalEnv = process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = "sk-ant-update-cache-test";

      try {
        const config = createConfig({ apiKey: undefined });
        registry.register(config);

        await registry.healthCheck(config.id);

        registry.update(config.id, { model: "claude-opus-4-20250514" });

        const result = await registry.healthCheck(config.id);
        expect(result.healthy).toBe(true);
      } finally {
        if (originalEnv === undefined) {
          delete process.env.ANTHROPIC_API_KEY;
        } else {
          process.env.ANTHROPIC_API_KEY = originalEnv;
        }
      }
    });
  });

  describe("remove()", () => {
    it("should remove existing provider", () => {
      const config = createConfig();
      registry.register(config);

      const result = registry.remove(config.id);

      expect(result.success).toBe(true);
      expect(result.providerId).toBe(config.id);
      expect(() => registry.get(config.id)).toThrow();
    });

    it("should throw when removing non-existent provider", () => {
      expect(() => {
        registry.remove("non-existent");
      }).toThrow("not found");
    });

    it("should clear default when removing default provider", () => {
      const config = createConfig();
      registry.register(config);
      registry.setDefault(config.id);

      registry.remove(config.id);

      const defaultResult = registry.getDefault();
      expect(defaultResult.providerId).toBeNull();
    });
  });

  describe("setDefault() and getDefault()", () => {
    it("should set default provider", () => {
      const config = createConfig();
      registry.register(config);

      const result = registry.setDefault(config.id);

      expect(result.success).toBe(true);
      expect(result.providerId).toBe(config.id);
    });

    it("should throw when setting default to non-existent provider", () => {
      expect(() => {
        registry.setDefault("non-existent");
      }).toThrow("not found");
    });

    it("should get current default provider when set", () => {
      const config = createConfig();
      registry.register(config);
      registry.setDefault(config.id);

      const result = registry.getDefault();

      expect(result.providerId).toBe(config.id);
      expect(result.config).toBeDefined();
      expect(result.config!.id).toBe(config.id);
    });

    it("should return null when no default is set", () => {
      const result = registry.getDefault();

      expect(result.providerId).toBeNull();
      expect(result.config).toBeUndefined();
    });
  });

  describe("healthCheck()", () => {
    it("should return healthy status for valid provider with env API key", async () => {
      const originalEnv = process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = "sk-ant-health-check-test";

      try {
        const config = createConfig({ apiKey: undefined });
        registry.register(config);

        const result = await registry.healthCheck(config.id);

        expect(result.healthy).toBe(true);
        expect(result.providerId).toBe(config.id);
      } finally {
        if (originalEnv === undefined) {
          delete process.env.ANTHROPIC_API_KEY;
        } else {
          process.env.ANTHROPIC_API_KEY = originalEnv;
        }
      }
    });

    it("should throw when checking health of non-existent provider", async () => {
      await expect(registry.healthCheck("non-existent")).rejects.toThrow("not found");
    });
  });

  describe("lazy instantiation", () => {
    it("should create instance lazily on first use", async () => {
      const originalEnv = process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = "sk-ant-lazy-test";

      try {
        const config = createConfig({ apiKey: undefined });
        registry.register(config);

        await registry.healthCheck(config.id);

        const result2 = await registry.healthCheck(config.id);
        expect(result2.healthy).toBe(true);
      } finally {
        if (originalEnv === undefined) {
          delete process.env.ANTHROPIC_API_KEY;
        } else {
          process.env.ANTHROPIC_API_KEY = originalEnv;
        }
      }
    });
  });

  describe("sensitive data masking", () => {
    it("should consistently mask API keys across list and get", () => {
      const config = createConfig();
      registry.register(config);

      const listResult = registry.list()[0];
      const getResult = registry.get(config.id);

      expect(listResult.apiKey).toBe(getResult.apiKey);
      expect(listResult.apiKey).toMatch(/^sk-ant-\.\.\.$/);
    });
  });

  describe("predictTokens()", () => {
    it("should fallback to generic heuristic if provider does not implement predictTokens natively", async () => {
      const config = createConfig();
      registry.register(config);

      const prediction = await registry.predictTokens(config.id, {
        messages: [{ role: "user", content: "Hello world" }],
      });

      // "Hello world" has 11 chars. 11 / 4 = 2.75 -> ceil -> 3
      expect(prediction.inputTokens).toBe(3);
    });
  });
});
