import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { BridgeServer } from "../src/bridge.js";
import { providerRegistry } from "../src/llm-provider/provider-registry.js";
import { balancerRegistry } from "../src/llm-provider/balancer-registry.js";
import { ConfigStore } from "../src/config-store.js";
import { join } from "path";
import { tmpdir } from "os";
import { unlinkSync, existsSync } from "fs";

describe("Load Balancer Bridge JSON-RPC Methods", () => {
  const storePath = join(tmpdir(), "bridge-balancer-test.json");
  let server: BridgeServer;

  beforeEach(() => {
    if (existsSync(storePath)) unlinkSync(storePath);
    // @ts-ignore
    balancerRegistry["configStore"] = new ConfigStore(storePath);
    
    server = new BridgeServer();

    try { providerRegistry.register({ id: "p1", type: "anthropic", apiKey: "test" }); } catch {}
    try { providerRegistry.register({ id: "p2", type: "anthropic", apiKey: "test" }); } catch {}
  });

  afterEach(() => {
    try { balancerRegistry.remove("bridge-b1"); } catch {}
    try { balancerRegistry.remove("bridge-b2"); } catch {}
    try { providerRegistry.remove("p1"); } catch {}
    try { providerRegistry.remove("p2"); } catch {}
    try { providerRegistry.remove("p-unknown"); } catch {}
    if (existsSync(storePath)) unlinkSync(storePath);
  });

  it("should handle balancer.create, list, status, remove", async () => {
    // create
    let res = await server.handleMessage({
      jsonrpc: "2.0", id: 1, method: "balancer.create",
      params: { id: "bridge-b1", strategy: "round-robin", providerIds: ["p1", "p2"] }
    });
    expect(res.error).toBeUndefined();
    expect((res.result as any).success).toBe(true);

    // list
    res = await server.handleMessage({
      jsonrpc: "2.0", id: 2, method: "balancer.list"
    });
    expect(res.error).toBeUndefined();
    const list = res.result as any[];
    expect(list.some(b => b.id === "bridge-b1" && b.strategy === "round-robin" && b.providerCount === 2)).toBe(true);

    // status
    res = await server.handleMessage({
      jsonrpc: "2.0", id: 3, method: "balancer.status",
      params: { balancerId: "bridge-b1" }
    });
    expect(res.error).toBeUndefined();
    const status = res.result as any;
    expect(status.balancerId).toBe("bridge-b1");
    expect(status.providers).toHaveLength(2);
    expect(status.providers[0].providerId).toBe("p1");
    expect(status.providers[0].excluded).toBe(false);

    // remove
    res = await server.handleMessage({
      jsonrpc: "2.0", id: 4, method: "balancer.remove",
      params: { balancerId: "bridge-b1" }
    });
    expect(res.error).toBeUndefined();
    expect((res.result as any).success).toBe(true);

    // list after remove
    res = await server.handleMessage({
      jsonrpc: "2.0", id: 5, method: "balancer.list"
    });
    expect((res.result as any[]).some(b => b.id === "bridge-b1")).toBe(false);
  });

  it("should fail balancer.create with unknown provider IDs", async () => {
    const res = await server.handleMessage({
      jsonrpc: "2.0", id: 1, method: "balancer.create",
      params: { id: "bridge-b2", strategy: "round-robin", providerIds: ["p-unknown"] }
    });
    expect(res.error).toBeDefined();
    expect(res.error?.code).toBe(-32001); // PROVIDER_NOT_FOUND
  });

  it("should handle session.setProvider with balancerId", async () => {
    // create balancer
    await server.handleMessage({
      jsonrpc: "2.0", id: 1, method: "balancer.create",
      params: { id: "bridge-b1", strategy: "round-robin", providerIds: ["p1", "p2"] }
    });

    // Start a mock session manually to avoid full agent startup overhead
    // @ts-ignore
    const sessionStore = server["sessionStore"];
    const session = sessionStore.create(tmpdir(), "test", false);

    const res = await server.handleMessage({
      jsonrpc: "2.0", id: 2, method: "session.setProvider",
      params: { sessionId: session.id, balancerId: "bridge-b1" }
    });
    expect(res.error).toBeUndefined();
    expect((res.result as any).balancerId).toBe("bridge-b1");

    const sessionState = sessionStore.get(session.id);
    expect(sessionState?.activeBalancerId).toBe("bridge-b1");
  });
});
