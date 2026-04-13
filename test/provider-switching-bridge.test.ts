import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { BridgeServer } from "../src/bridge.js";
import type { ProviderConfig } from "../src/llm-provider/types.js";

describe("Provider Switching - JSON-RPC Integration", () => {
  let bridge: BridgeServer;
  const notifications: Array<{ method: string; params: unknown }> = [];
  const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
  const originalQuery = globalThis.__AI_SPEC_SDK_QUERY__;

  function createConfig(overrides?: Partial<ProviderConfig>): ProviderConfig {
    return {
      id: `ps-integration-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type: "anthropic",
      apiKey: "sk-ant-ps-test-key-1234567890",
      ...overrides,
    };
  }

  beforeEach(() => {
    notifications.length = 0;
    process.env.ANTHROPIC_API_KEY = "sk-ant-fallback-test-key";
    globalThis.__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "test response" }] } };
    } as ReturnType<NonNullable<typeof globalThis.__AI_SPEC_SDK_QUERY__>>;
    bridge = new BridgeServer({
      notify(msg) {
        if (msg.method && msg.method.startsWith("bridge/")) {
          notifications.push({ method: msg.method, params: msg.params });
        }
      },
    });
  });

  afterEach(() => {
    if (originalQuery === undefined) {
      delete globalThis.__AI_SPEC_SDK_QUERY__;
    } else {
      globalThis.__AI_SPEC_SDK_QUERY__ = originalQuery;
    }
    if (originalAnthropicKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
    }
  });

  async function createSession(workspace?: string): Promise<string> {
    const wsPath = workspace ?? `/tmp/ps-test-workspace-${Date.now()}`;
    await import("node:fs").then((fs) => fs.promises.mkdir(wsPath, { recursive: true }));

    const response = await bridge.handleMessage({
      jsonrpc: "2.0",
      method: "session.start",
      params: {
        workspace: wsPath,
        prompt: "test prompt for provider switching",
        options: {},
      },
      id: 1,
    });

    if (response.error) throw new Error(`Session start failed: ${JSON.stringify(response.error)}`);
    return (response.result as Record<string, unknown>).sessionId as string;
  }

  describe("provider.switch", () => {
    it("should switch provider on an existing session", async () => {
      const config = createConfig();
      await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.register",
        params: config,
        id: 1,
      });

      const sessionId = await createSession();

      const switchResponse = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.switch",
        params: { sessionId, providerId: config.id },
        id: 2,
      });

      expect(switchResponse.error).toBeUndefined();
      expect(switchResponse.result).toEqual({
        success: true,
        sessionId,
        previousProviderId: null,
        newProviderId: config.id,
      });
    });

    it("should emit provider_switched notification on successful switch", async () => {
      const config = createConfig();
      await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.register",
        params: config,
        id: 1,
      });

      const sessionId = await createSession();

      await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.switch",
        params: { sessionId, providerId: config.id },
        id: 2,
      });

      const switchedNotif = notifications.find((n) => n.method === "bridge/provider_switched");
      expect(switchedNotif).toBeDefined();
      expect((switchedNotif!.params as Record<string, unknown>).sessionId).toBe(sessionId);
      expect((switchedNotif!.params as Record<string, unknown>).newProviderId).toBe(config.id);
    });

    it("should return error when sessionId is missing", async () => {
      const config = createConfig();
      await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.register",
        params: config,
        id: 1,
      });

      const response = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.switch",
        params: { providerId: config.id },
        id: 2,
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32602);
      expect(response.error!.message).toContain("'sessionId'");
    });

    it("should return error when providerId is missing", async () => {
      const sessionId = await createSession();

      const response = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.switch",
        params: { sessionId },
        id: 2,
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32602);
      expect(response.error!.message).toContain("'providerId'");
    });

    it("should return error for non-existent session", async () => {
      const config = createConfig();
      await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.register",
        params: config,
        id: 1,
      });

      const response = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.switch",
        params: { sessionId: "non-existent-session", providerId: config.id },
        id: 2,
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32011);
    });
  });

  describe("session.setProvider", () => {
    it("should behave identically to provider.switch", async () => {
      const config = createConfig();
      await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.register",
        params: config,
        id: 1,
      });

      const sessionId = await createSession();

      const setProviderResponse = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "session.setProvider",
        params: { sessionId, providerId: config.id },
        id: 2,
      });

      expect(setProviderResponse.error).toBeUndefined();
      expect(setProviderResponse.result).toEqual({
        success: true,
        sessionId,
        previousProviderId: null,
        newProviderId: config.id,
      });
    });
  });

  describe("session.status includes activeProviderId", () => {
    it("should show null activeProviderId before switching", async () => {
      const sessionId = await createSession();

      const statusResponse = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "session.status",
        params: { sessionId },
        id: 2,
      });

      expect(statusResponse.error).toBeUndefined();
      const result = statusResponse.result as Record<string, unknown>;
      expect(result.activeProviderId).toBeNull();
    });

    it("should show updated activeProviderId after switching", async () => {
      const config = createConfig();
      await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.register",
        params: config,
        id: 1,
      });

      const sessionId = await createSession();

      await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.switch",
        params: { sessionId, providerId: config.id },
        id: 2,
      });

      const statusResponse = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "session.status",
        params: { sessionId },
        id: 3,
      });

      expect(statusResponse.error).toBeUndefined();
      const result = statusResponse.result as Record<string, unknown>;
      expect(result.activeProviderId).toBe(config.id);
    });
  });

  describe("capabilities includes new methods", () => {
    it("should list provider.switch and session.setProvider in capabilities", async () => {
      const capsResponse = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "bridge.capabilities",
        params: {},
        id: 1,
      });

      expect(capsResponse.error).toBeUndefined();
      const caps = capsResponse.result as Record<string, unknown>;
      const methods = caps.methods as string[];

      expect(methods).toContain("provider.switch");
      expect(methods).toContain("session.setProvider");
    });
  });

  describe("provider.switch > additional coverage", () => {
    it("should return error -32001 for non-existent provider", async () => {
      const sessionId = await createSession();

      const response = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.switch",
        params: { sessionId, providerId: "non-existent-provider" },
        id: 2,
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32001);
      expect(response.error!.message).toContain("not found");
    });

    it("should reject switch when sessionId is not a string", async () => {
      const config = createConfig();
      await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.register",
        params: config,
        id: 1,
      });

      const response = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.switch",
        params: { sessionId: 12345, providerId: config.id },
        id: 2,
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32602);
    });

    it("should reject switch when providerId is not a string", async () => {
      const sessionId = await createSession();

      const response = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.switch",
        params: { sessionId, providerId: 99999 },
        id: 2,
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32602);
    });

    it("should include timestamp in provider_switched notification", async () => {
      const config = createConfig();
      await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.register",
        params: config,
        id: 1,
      });

      const sessionId = await createSession();

      await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.switch",
        params: { sessionId, providerId: config.id },
        id: 2,
      });

      const switchedNotif = notifications.find((n) => n.method === "bridge/provider_switched");
      expect(switchedNotif).toBeDefined();
      const params = switchedNotif!.params as Record<string, unknown>;
      expect(params).toHaveProperty("timestamp");
      expect(typeof params.timestamp).toBe("string");
      expect(Date.parse(params.timestamp as string)).not.toBeNaN();
    });
  });
});
