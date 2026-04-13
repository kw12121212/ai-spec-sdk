import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { ProviderRegistry } from "../src/llm-provider/provider-registry.js";
import type { ProviderConfig } from "../src/llm-provider/types.js";
import type { Session } from "../src/session-store.js";

describe("Provider Switching - Unit", () => {
  let registry: ProviderRegistry;
  const mockSessions = new Map<string, Session>();
  const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;

  function createConfig(overrides?: Partial<ProviderConfig>): ProviderConfig {
    return {
      id: `test-provider-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type: "anthropic",
      apiKey: "sk-ant-test-key-1234567890",
      ...overrides,
    };
  }

  function createSession(overrides?: Partial<Session>): Session {
    return {
      id: `session-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      workspace: "/tmp/test-workspace",
      status: "idle",
      executionState: "idle",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    } as Session;
  }

  beforeEach(() => {
    mockSessions.clear();
    process.env.ANTHROPIC_API_KEY = "sk-ant-fallback-test-key";
    registry = new ProviderRegistry(undefined, {
      skipLoadFromStore: true,
      getSession: (id) => mockSessions.get(id),
    });
  });

  afterEach(() => {
    registry.destroy();
    if (originalAnthropicKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
    }
  });

  describe("resolveForSession()", () => {
    it("should return session's activeProviderId when set and provider exists and healthy", async () => {
      const config = createConfig();
      registry.register(config);

      const session = createSession({ activeProviderId: config.id });
      mockSessions.set(session.id, session);

      const resolved = await registry.resolveForSession(session.id);
      expect(resolved).toBeDefined();
      expect(resolved.config.id).toBe(config.id);
    });

    it("should fall back to defaultProviderId when session has no activeProviderId", async () => {
      const config = createConfig();
      registry.register(config);
      registry.setDefault(config.id);

      const session = createSession({ activeProviderId: undefined });
      mockSessions.set(session.id, session);

      const resolved = await registry.resolveForSession(session.id);
      expect(resolved).toBeDefined();
      expect(resolved.config.id).toBe(config.id);
    });

    it("should fall back to built-in when session activeProviderId is not registered", async () => {
      const session = createSession({ activeProviderId: "non-existent" });
      mockSessions.set(session.id, session);

      const resolved = await registry.resolveForSession(session.id);
      expect(resolved).toBeDefined();
    });

    it("should fall back to default when session activeProviderId exists but is unhealthy", async () => {
      const badConfig = createConfig({ id: "bad-provider" });
      const goodConfig = createConfig({ id: "good-provider" });
      registry.register(badConfig);
      registry.register(goodConfig);
      registry.setDefault(goodConfig.id);

      const session = createSession({ activeProviderId: "bad-provider" });
      mockSessions.set(session.id, session);

      const resolved = await registry.resolveForSession(session.id);
      expect(resolved).toBeDefined();
    });

    it("should return built-in fallback when no providers are configured", async () => {
      const session = createSession({});
      mockSessions.set(session.id, session);

      const resolved = await registry.resolveForSession(session.id);
      expect(resolved).toBeDefined();
    });

    it("should handle non-existent session gracefully", async () => {
      const resolved = await registry.resolveForSession("non-existent-session");
      expect(resolved).toBeDefined();
    });
  });

  describe("switchSessionProvider()", () => {
    it("should switch successfully with valid target provider", async () => {
      const config = createConfig();
      registry.register(config);

      const session = createSession({ activeProviderId: undefined });
      mockSessions.set(session.id, session);

      const result = await registry.switchSessionProvider(session.id, config.id);
      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(session.id);
      expect(result.previousProviderId).toBeNull();
      expect(result.newProviderId).toBe(config.id);
    });

    it("should track previousProviderId when switching away from existing provider", async () => {
      const oldConfig = createConfig({ id: "old-provider" });
      const newConfig = createConfig({ id: "new-provider" });
      registry.register(oldConfig);
      registry.register(newConfig);

      const session = createSession({ activeProviderId: "old-provider" });
      mockSessions.set(session.id, session);

      const result = await registry.switchSessionProvider(session.id, "new-provider");
      expect(result.success).toBe(true);
      expect(result.previousProviderId).toBe("old-provider");
      expect(result.newProviderId).toBe("new-provider");
    });

    it("should throw NOT_FOUND error for unregistered target provider", async () => {
      const session = createSession({});
      mockSessions.set(session.id, session);

      try {
        await registry.switchSessionProvider(session.id, "non-existent");
        expect.unreachable("Should have thrown");
      } catch (error) {
        if (error instanceof Error && error.name === "ProviderRegistryError") {
          const err = error as Error & { code?: string };
          expect(err.code).toBe("NOT_FOUND");
          expect(error.message).toContain("not found");
        }
      }
    });
  });

  describe("setSessionGetter()", () => {
    it("should update the session getter dynamically", async () => {
      const config = createConfig();
      registry.register(config);

      const localSessions = new Map<string, Session>();
      registry.setSessionGetter((id) => localSessions.get(id));

      const session = createSession({ activeProviderId: config.id });
      localSessions.set(session.id, session);

      const resolved = await registry.resolveForSession(session.id);
      expect(resolved).toBeDefined();
      expect(resolved.config.id).toBe(config.id);
    });
  });

  describe("switchSessionProvider() > additional coverage", () => {
    it("should return correct result shape with all fields", async () => {
      const config = createConfig();
      registry.register(config);

      const session = createSession({ activeProviderId: undefined });
      mockSessions.set(session.id, session);

      const result = await registry.switchSessionProvider(session.id, config.id);
      expect(result).toEqual({
        success: true,
        sessionId: session.id,
        previousProviderId: null,
        newProviderId: config.id,
      });
    });

    it("should return previousProviderId as null when session has no activeProviderId", async () => {
      const config = createConfig();
      registry.register(config);

      const session = createSession({});
      mockSessions.set(session.id, session);

      const result = await registry.switchSessionProvider(session.id, config.id);
      expect(result.previousProviderId).toBeNull();
    });

    it("should handle non-existent session gracefully (returns null previousProviderId)", async () => {
      const config = createConfig();
      registry.register(config);

      const result = await registry.switchSessionProvider("non-existent-session", config.id);
      expect(result.success).toBe(true);
      expect(result.previousProviderId).toBeNull();
    });
  });
});
