import { describe, it, expect, beforeEach } from "bun:test";
import { BridgeServer } from "../src/bridge.js";
import type { ProviderConfig } from "../src/llm-provider/types.js";

describe("Provider Registry - JSON-RPC Integration", () => {
  let bridge: BridgeServer;

  beforeEach(() => {
    bridge = new BridgeServer();
  });

  const validConfig: ProviderConfig = {
    id: `integration-test-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    type: "anthropic",
    apiKey: "sk-ant-integration-test-1234567890",
  };

  describe("provider.register", () => {
    it("should register a valid provider successfully", async () => {
      const response = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.register",
        params: validConfig,
        id: 1,
      });

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(1);
      expect(response.result).toEqual({
        success: true,
        providerId: validConfig.id,
      });
    });

    it("should return error for invalid configuration", async () => {
      const response = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.register",
        params: { invalid: "config" },
        id: 1,
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32602);
    });

    it("should return error for duplicate provider ID", async () => {
      await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.register",
        params: validConfig,
        id: 1,
      });

      const response = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.register",
        params: validConfig,
        id: 2,
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32002);
    });
  });

  describe("provider.list", () => {
    it("should list all registered providers", async () => {
      await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.register",
        params: validConfig,
        id: 1,
      });

      const response = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.list",
        params: {},
        id: 2,
      });

      expect(response.jsonrpc).toBe("2.0");
      expect(Array.isArray(response.result)).toBe(true);
      expect((response.result as Array<unknown>).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("provider.get", () => {
    it("should get existing provider by ID", async () => {
      await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.register",
        params: validConfig,
        id: 1,
      });

      const response = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.get",
        params: { providerId: validConfig.id },
        id: 2,
      });

      expect(response.jsonrpc).toBe("2.0");
      expect(response.result.id).toBe(validConfig.id);
    });

    it("should return error for non-existent provider", async () => {
      const response = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.get",
        params: { providerId: "non-existent" },
        id: 1,
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32001);
    });
  });

  describe("provider.update", () => {
    it("should update existing provider configuration", async () => {
      await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.register",
        params: validConfig,
        id: 1,
      });

      const response = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.update",
        params: {
          providerId: validConfig.id,
          config: { model: "claude-opus-4-20250514" },
        },
        id: 2,
      });

      expect(response.jsonrpc).toBe("2.0");
      expect(response.result.model).toBe("claude-opus-4-20250514");
    });

    it("should return error when updating non-existent provider", async () => {
      const response = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.update",
        params: {
          providerId: "non-existent",
          config: { model: "new-model" },
        },
        id: 1,
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32001);
    });
  });

  describe("provider.remove", () => {
    it("should remove existing provider", async () => {
      await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.register",
        params: validConfig,
        id: 1,
      });

      const response = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.remove",
        params: { providerId: validConfig.id },
        id: 2,
      });

      expect(response.jsonrpc).toBe("2.0");
      expect(response.result.success).toBe(true);
    });

    it("should return error when removing non-existent provider", async () => {
      const response = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.remove",
        params: { providerId: "non-existent" },
        id: 1,
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32001);
    });
  });

  describe("provider.setDefault and provider.getDefault", () => {
    it("should set default provider", async () => {
      await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.register",
        params: validConfig,
        id: 1,
      });

      const response = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.setDefault",
        params: { providerId: validConfig.id },
        id: 2,
      });

      expect(response.jsonrpc).toBe("2.0");
      expect(response.result.success).toBe(true);
    });

    it("should return error when setting default to non-existent provider", async () => {
      const response = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.setDefault",
        params: { providerId: "non-existent" },
        id: 1,
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32001);
    });

    it("should get current default provider", async () => {
      await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.register",
        params: validConfig,
        id: 1,
      });

      await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.setDefault",
        params: { providerId: validConfig.id },
        id: 2,
      });

      const response = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.getDefault",
        params: {},
        id: 3,
      });

      expect(response.jsonrpc).toBe("2.0");
      expect(response.result.providerId).toBe(validConfig.id);
    });
  });

  describe("provider.healthCheck", () => {
    it("should check health of a provider with env API key", async () => {
      const originalEnv = process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = "sk-ant-health-integration-test";

      try {
        const configWithEnvOnly: ProviderConfig = {
          id: `health-check-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          type: "anthropic",
        };

        await bridge.handleMessage({
          jsonrpc: "2.0",
          method: "provider.register",
          params: configWithEnvOnly,
          id: 1,
        });

        const response = await bridge.handleMessage({
          jsonrpc: "2.0",
          method: "provider.healthCheck",
          params: { providerId: configWithEnvOnly.id },
          id: 2,
        });

        expect(response.jsonrpc).toBe("2.0");
        expect(response.result.healthy).toBe(true);
      } finally {
        if (originalEnv === undefined) {
          delete process.env.ANTHROPIC_API_KEY;
        } else {
          process.env.ANTHROPIC_API_KEY = originalEnv;
        }
      }
    });

    it("should return error when checking health of non-existent provider", async () => {
      const response = await bridge.handleMessage({
        jsonrpc: "2.0",
        method: "provider.healthCheck",
        params: { providerId: "non-existent" },
        id: 1,
      });

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32001);
    });
  });
});
