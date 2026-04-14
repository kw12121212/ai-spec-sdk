import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ProviderRegistry } from "../src/llm-provider/provider-registry.js";
import { BridgeServer } from "../src/bridge.js";
import type { ProviderConfig } from "../src/llm-provider/types.js";
import type { LLMProvider, QueryOptions, QueryResult, StreamEvent, ProviderCapabilities } from "../src/llm-provider/types.js";
import type { Session } from "../src/session-store.js";
import { ConfigStore } from "../src/config-store.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides?: Partial<ProviderConfig>): ProviderConfig {
  return {
    id: `prov-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    type: "anthropic",
    apiKey: "sk-ant-test-key-1234567890",
    ...overrides,
  };
}

function makeSession(overrides?: Partial<Session>): Session {
  return {
    id: `sess-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    workspace: "/tmp/test",
    status: "idle",
    executionState: "idle",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Session;
}

/** Creates a stub LLMProvider that always returns `healthy: true` and succeeds queries. */
function makeStubProvider(id: string, type: "anthropic" = "anthropic"): LLMProvider {
  return {
    id,
    config: { id, type, apiKey: "sk-stub" },
    initialize: async () => {},
    healthCheck: async () => true,
    getCapabilities(): ProviderCapabilities {
      return { streaming: true, tokenUsageTracking: false, functionCalling: false, supportedModels: [] };
    },
    query: async (): Promise<QueryResult> => ({ status: "completed", result: `result-from-${id}`, usage: null }),
    queryStream: async (_opts: QueryOptions, onEvent: (e: StreamEvent) => void): Promise<QueryResult> => {
      onEvent({ type: "complete", data: { result: `result-from-${id}`, usage: null } });
      return { status: "completed", result: `result-from-${id}`, usage: null };
    },
    destroy: () => {},
  };
}

/** Creates a stub LLMProvider whose query always throws. */
function makeFailingProvider(id: string, message = "provider error"): LLMProvider {
  return {
    id,
    config: { id, type: "anthropic", apiKey: "sk-stub" },
    initialize: async () => {},
    healthCheck: async () => true,
    getCapabilities(): ProviderCapabilities {
      return { streaming: true, tokenUsageTracking: false, functionCalling: false, supportedModels: [] };
    },
    query: async (): Promise<QueryResult> => { throw new Error(message); },
    queryStream: async (): Promise<QueryResult> => { throw new Error(message); },
    destroy: () => {},
  };
}

// ---------------------------------------------------------------------------
// Registry unit tests
// ---------------------------------------------------------------------------

describe("ProviderRegistry — fallback chain", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  let registry: ProviderRegistry;
  const mockSessions = new Map<string, Session>();

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    registry = new ProviderRegistry(undefined, {
      skipLoadFromStore: true,
      getSession: (id) => mockSessions.get(id),
    });
    mockSessions.clear();
  });

  afterEach(() => {
    registry.destroy();
    if (originalKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });

  // ── register / getFallbackChain ──────────────────────────────────────────

  it("register() stores fallbackProviderIds and getFallbackChain() returns them", () => {
    const config = makeConfig({ fallbackProviderIds: ["b1", "b2"] });
    registry.register(config);

    expect(registry.getFallbackChain(config.id)).toEqual(["b1", "b2"]);
  });

  it("getFallbackChain() returns [] for provider without fallbackProviderIds", () => {
    const config = makeConfig();
    registry.register(config);

    expect(registry.getFallbackChain(config.id)).toEqual([]);
  });

  it("getFallbackChain() throws NOT_FOUND for unknown provider", () => {
    expect(() => registry.getFallbackChain("unknown")).toThrow("not found");
  });

  it("validateConfig() rejects non-array fallbackProviderIds", () => {
    const config = makeConfig({ fallbackProviderIds: "not-an-array" as unknown as string[] });

    expect(() => registry.register(config)).toThrow("Invalid configuration");
  });

  // ── persistence round-trip ────────────────────────────────────────────────

  it("fallbackProviderIds survives saveToStore → loadFromStore round-trip", () => {
    const userSettingsPath = path.join(os.homedir(), ".claude", "settings.json");
    let orig: string | undefined;
    try { orig = fs.readFileSync(userSettingsPath, "utf8"); } catch { orig = undefined; }

    try {
      const store = new ConfigStore();
      const r1 = new ProviderRegistry(store, { skipLoadFromStore: false });
      const config = makeConfig({ fallbackProviderIds: ["backup-1"] });
      r1.register(config);
      r1.destroy();

      const r2 = new ProviderRegistry(store, { skipLoadFromStore: false });
      expect(r2.getFallbackChain(config.id)).toEqual(["backup-1"]);
      r2.destroy();
    } finally {
      if (orig !== undefined) {
        fs.mkdirSync(path.dirname(userSettingsPath), { recursive: true });
        fs.writeFileSync(userSettingsPath, orig, "utf8");
      } else {
        try { fs.unlinkSync(userSettingsPath); } catch { /* already gone */ }
      }
    }
  });

  // ── getSessionCandidateIds ────────────────────────────────────────────────

  it("getSessionCandidateIds returns [sessionActive, ...fallbackIds, default] deduplicated", () => {
    const primary = makeConfig({ id: "primary", fallbackProviderIds: ["fb1", "fb2"] });
    const fb1 = makeConfig({ id: "fb1" });
    const fb2 = makeConfig({ id: "fb2" });
    const dflt = makeConfig({ id: "default" });
    registry.register(primary);
    registry.register(fb1);
    registry.register(fb2);
    registry.register(dflt);
    registry.setDefault("default");

    const session = makeSession({ activeProviderId: "primary" });
    mockSessions.set(session.id, session);

    expect(registry.getSessionCandidateIds(session.id)).toEqual(["primary", "fb1", "fb2", "default"]);
  });

  it("getSessionCandidateIds deduplicates when default is already in fallback chain", () => {
    const primary = makeConfig({ id: "primary", fallbackProviderIds: ["dflt"] });
    const dflt = makeConfig({ id: "dflt" });
    registry.register(primary);
    registry.register(dflt);
    registry.setDefault("dflt");

    const session = makeSession({ activeProviderId: "primary" });
    mockSessions.set(session.id, session);

    expect(registry.getSessionCandidateIds(session.id)).toEqual(["primary", "dflt"]);
  });

  it("getSessionCandidateIds returns [] when session has no active provider and no default", () => {
    const session = makeSession({});
    mockSessions.set(session.id, session);

    expect(registry.getSessionCandidateIds(session.id)).toEqual([]);
  });

  it("getSessionCandidateIds skips fallback IDs that are not registered", () => {
    const primary = makeConfig({ id: "primary", fallbackProviderIds: ["unregistered", "fb1"] });
    const fb1 = makeConfig({ id: "fb1" });
    registry.register(primary);
    registry.register(fb1);

    const session = makeSession({ activeProviderId: "primary" });
    mockSessions.set(session.id, session);

    expect(registry.getSessionCandidateIds(session.id)).toEqual(["primary", "fb1"]);
  });

  // ── update fallback chain ─────────────────────────────────────────────────

  it("update() can add a fallback chain", () => {
    const config = makeConfig({ id: "p1" });
    registry.register(config);

    registry.update("p1", { fallbackProviderIds: ["b1"] });

    expect(registry.getFallbackChain("p1")).toEqual(["b1"]);
  });
});

// ---------------------------------------------------------------------------
// Bridge-level fallback behaviour
// ---------------------------------------------------------------------------

describe("ProviderRegistry — reactive fallback via resolveCandidate", () => {
  /**
   * These tests wire up a ProviderRegistry with stub providers and simulate
   * the bridge's fallback loop logic directly (without invoking a real session).
   */

  const originalKey = process.env.ANTHROPIC_API_KEY;
  let registry: ProviderRegistry;
  const mockSessions = new Map<string, Session>();

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    registry = new ProviderRegistry(undefined, {
      skipLoadFromStore: true,
      getSession: (id) => mockSessions.get(id),
    });
    mockSessions.clear();
  });

  afterEach(() => {
    registry.destroy();
    if (originalKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });

  async function runFallbackLoop(
    sessionId: string,
    executeQuery: (provider: LLMProvider) => Promise<string>,
    onFallback: (from: string, to: string, reason: string) => void,
  ): Promise<string> {
    const candidateIds = registry.getSessionCandidateIds(sessionId);

    if (candidateIds.length === 0) {
      throw new Error("no candidates");
    }

    let lastError: unknown = null;
    let fromProviderId: string | null = null;

    for (const candidateId of candidateIds) {
      if (fromProviderId !== null) {
        onFallback(fromProviderId, candidateId, lastError instanceof Error ? lastError.message : String(lastError));
      }

      try {
        const provider = await registry.resolveCandidate(candidateId);
        return await executeQuery(provider);
      } catch (err) {
        lastError = err;
        fromProviderId = candidateId;
      }
    }

    throw lastError;
  }

  it("uses primary when it succeeds (no fallback invoked)", async () => {
    const primary = makeConfig({ id: "primary", fallbackProviderIds: ["backup"] });
    const backup = makeConfig({ id: "backup" });

    // Register real configs; override instances with stubs
    registry.register(primary);
    registry.register(backup);

    // Patch: make resolveCandidate return our stubs
    const stubPrimary = makeStubProvider("primary");
    const stubBackup = makeStubProvider("backup");
    const origResolve = registry.resolveCandidate.bind(registry);
    registry.resolveCandidate = async (id: string) => {
      if (id === "primary") return stubPrimary;
      if (id === "backup") return stubBackup;
      return origResolve(id);
    };

    const session = makeSession({ activeProviderId: "primary" });
    mockSessions.set(session.id, session);

    const fallbackEvents: string[] = [];
    const result = await runFallbackLoop(
      session.id,
      (p) => p.query({ messages: [] }).then((r) => r.result as string),
      (from, to) => fallbackEvents.push(`${from}→${to}`),
    );

    expect(result).toBe("result-from-primary");
    expect(fallbackEvents).toHaveLength(0);
  });

  it("falls back when primary fails, returns result from backup", async () => {
    const primary = makeConfig({ id: "primary", fallbackProviderIds: ["backup"] });
    const backup = makeConfig({ id: "backup" });
    registry.register(primary);
    registry.register(backup);

    const stubPrimary = makeFailingProvider("primary", "primary unavailable");
    const stubBackup = makeStubProvider("backup");
    registry.resolveCandidate = async (id: string) => {
      if (id === "primary") return stubPrimary;
      return stubBackup;
    };

    const session = makeSession({ activeProviderId: "primary" });
    mockSessions.set(session.id, session);

    const fallbackEvents: Array<{ from: string; to: string; reason: string }> = [];
    const result = await runFallbackLoop(
      session.id,
      (p) => p.query({ messages: [] }).then((r) => r.result as string),
      (from, to, reason) => fallbackEvents.push({ from, to, reason }),
    );

    expect(result).toBe("result-from-backup");
    expect(fallbackEvents).toHaveLength(1);
    expect(fallbackEvents[0]).toEqual({ from: "primary", to: "backup", reason: "primary unavailable" });
  });

  it("walks chain in order, stops at first success (b2)", async () => {
    const primary = makeConfig({ id: "primary", fallbackProviderIds: ["b1", "b2"] });
    const b1 = makeConfig({ id: "b1" });
    const b2 = makeConfig({ id: "b2" });
    registry.register(primary);
    registry.register(b1);
    registry.register(b2);

    registry.resolveCandidate = async (id: string) => {
      if (id === "b2") return makeStubProvider("b2");
      return makeFailingProvider(id);
    };

    const session = makeSession({ activeProviderId: "primary" });
    mockSessions.set(session.id, session);

    const events: string[] = [];
    const result = await runFallbackLoop(
      session.id,
      (p) => p.query({ messages: [] }).then((r) => r.result as string),
      (from, to) => events.push(`${from}→${to}`),
    );

    expect(result).toBe("result-from-b2");
    expect(events).toEqual(["primary→b1", "b1→b2"]);
  });

  it("throws when all providers in chain fail", async () => {
    const primary = makeConfig({ id: "primary", fallbackProviderIds: ["backup"] });
    const backup = makeConfig({ id: "backup" });
    registry.register(primary);
    registry.register(backup);

    registry.resolveCandidate = async (id: string) => makeFailingProvider(id, `${id} error`);

    const session = makeSession({ activeProviderId: "primary" });
    mockSessions.set(session.id, session);

    await expect(
      runFallbackLoop(session.id, (p) => p.query({ messages: [] }).then((r) => r.result as string), () => {}),
    ).rejects.toThrow("backup error");
  });

  it("emits one event per chain step (two steps: primary→b1→b2)", async () => {
    const primary = makeConfig({ id: "primary", fallbackProviderIds: ["b1", "b2"] });
    const b1 = makeConfig({ id: "b1" });
    const b2 = makeConfig({ id: "b2" });
    registry.register(primary);
    registry.register(b1);
    registry.register(b2);

    registry.resolveCandidate = async (id: string) => {
      if (id === "b2") return makeStubProvider("b2");
      return makeFailingProvider(id);
    };

    const session = makeSession({ activeProviderId: "primary" });
    mockSessions.set(session.id, session);

    const events: Array<{ from: string; to: string }> = [];
    await runFallbackLoop(
      session.id,
      (p) => p.query({ messages: [] }).then((r) => r.result as string),
      (from, to) => events.push({ from, to }),
    );

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ from: "primary", to: "b1" });
    expect(events[1]).toEqual({ from: "b1", to: "b2" });
  });

  it("sessions with no fallback config return empty candidate list (existing path)", () => {
    const config = makeConfig({ id: "p1" });
    registry.register(config);

    const session = makeSession({ activeProviderId: "p1" });
    mockSessions.set(session.id, session);

    const candidates = registry.getSessionCandidateIds(session.id);
    // p1 has no fallbackProviderIds and no default — only the active provider
    expect(candidates).toEqual(["p1"]);
  });
});

// ---------------------------------------------------------------------------
// Bridge JSON-RPC: provider.getFallbackChain
// ---------------------------------------------------------------------------

describe("Bridge — provider.getFallbackChain", () => {
  let bridge: BridgeServer;

  beforeEach(() => {
    bridge = new BridgeServer();
  });

  it("returns configured fallback chain after provider.register with fallbackProviderIds", async () => {
    const config = makeConfig({ id: "primary-chain-test", fallbackProviderIds: ["b1", "b2"] });

    await bridge.handleMessage({
      jsonrpc: "2.0",
      method: "provider.register",
      params: config,
      id: 1,
    });

    const response = await bridge.handleMessage({
      jsonrpc: "2.0",
      method: "provider.getFallbackChain",
      params: { providerId: config.id },
      id: 2,
    });

    expect(response.error).toBeUndefined();
    expect(response.result).toEqual({ providerId: config.id, fallbackProviderIds: ["b1", "b2"] });
  });

  it("returns empty array for provider without fallbackProviderIds", async () => {
    const config = makeConfig({ id: "no-chain-test" });

    await bridge.handleMessage({
      jsonrpc: "2.0",
      method: "provider.register",
      params: config,
      id: 1,
    });

    const response = await bridge.handleMessage({
      jsonrpc: "2.0",
      method: "provider.getFallbackChain",
      params: { providerId: config.id },
      id: 2,
    });

    expect(response.error).toBeUndefined();
    expect(response.result).toEqual({ providerId: config.id, fallbackProviderIds: [] });
  });

  it("returns -32001 for unknown provider", async () => {
    const response = await bridge.handleMessage({
      jsonrpc: "2.0",
      method: "provider.getFallbackChain",
      params: { providerId: "unknown-provider" },
      id: 1,
    });

    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(-32001);
  });

  it("provider.register with non-array fallbackProviderIds returns -32602", async () => {
    const response = await bridge.handleMessage({
      jsonrpc: "2.0",
      method: "provider.register",
      params: makeConfig({ fallbackProviderIds: "not-an-array" as unknown as string[] }),
      id: 1,
    });

    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(-32602);
  });

  it("provider.update can set fallbackProviderIds", async () => {
    const config = makeConfig({ id: "update-chain-test" });

    await bridge.handleMessage({
      jsonrpc: "2.0",
      method: "provider.register",
      params: config,
      id: 1,
    });

    const updateResponse = await bridge.handleMessage({
      jsonrpc: "2.0",
      method: "provider.update",
      params: { providerId: config.id, config: { fallbackProviderIds: ["backup"] } },
      id: 2,
    });

    expect(updateResponse.error).toBeUndefined();

    const chainResponse = await bridge.handleMessage({
      jsonrpc: "2.0",
      method: "provider.getFallbackChain",
      params: { providerId: config.id },
      id: 3,
    });

    expect(chainResponse.result).toEqual({ providerId: config.id, fallbackProviderIds: ["backup"] });
  });
});
