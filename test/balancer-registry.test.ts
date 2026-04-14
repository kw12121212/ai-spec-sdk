import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { BalancerRegistry } from "../src/llm-provider/balancer-registry.js";
import { ConfigStore } from "../src/config-store.js";
import { unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("BalancerRegistry", () => {
  const storePath = join(tmpdir(), "test-balancer-registry.json");

  beforeEach(() => {
    if (existsSync(storePath)) unlinkSync(storePath);
  });

  afterEach(() => {
    if (existsSync(storePath)) unlinkSync(storePath);
  });

  it("should manage create/remove/list/route lifecycle", () => {
    const store = new ConfigStore(storePath);
    const registry = new BalancerRegistry(store, { skipLoadFromStore: true });
    
    registry.setKnownProviderIds(new Set(["p1", "p2"]));

    registry.create({
      id: "b1",
      strategy: "round-robin",
      providerIds: ["p1", "p2"]
    });

    const list = registry.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("b1");
    expect(list[0].providerCount).toBe(2);

    expect(registry.route("b1")).toBe("p1");

    registry.remove("b1");
    expect(registry.list()).toHaveLength(0);
  });

  it("should fail to create with unknown provider ID", () => {
    const store = new ConfigStore(storePath);
    const registry = new BalancerRegistry(store, { skipLoadFromStore: true });
    registry.setKnownProviderIds(new Set(["p1"]));

    expect(() => {
      registry.create({
        id: "b2",
        strategy: "round-robin",
        providerIds: ["p2"]
      });
    }).toThrow("Provider not found: p2");
  });

  it("should throw on unknown balancer ID", () => {
    const store = new ConfigStore(storePath);
    const registry = new BalancerRegistry(store, { skipLoadFromStore: true });
    
    expect(() => registry.get("unknown")).toThrow("Balancer not found: unknown");
    expect(() => registry.route("unknown")).toThrow("Balancer not found: unknown");
  });

  it("should persist and load from store (round-trip)", () => {
    const store1 = new ConfigStore(storePath);
    const registry1 = new BalancerRegistry(store1, { skipLoadFromStore: true });
    
    registry1.setKnownProviderIds(new Set(["p1", "p2"]));
    registry1.create({
      id: "b-persist",
      strategy: "weighted",
      providerIds: ["p1", "p2"],
      weights: [2, 1]
    });

    const store2 = new ConfigStore(storePath);
    const registry2 = new BalancerRegistry(store2);
    
    const list = registry2.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("b-persist");
    expect(list[0].strategy).toBe("weighted");
  });
});
