import { describe, test, expect } from "bun:test";
import {
  PolicyChain,
  registerPolicy,
  hasPolicy,
  getRegisteredPolicyNames,
  resolvePolicies,
} from "../src/permission-policy.js";
import type { PermissionPolicy, PolicyContext, PolicyResult } from "../src/permission-policy.js";

// Helper: create a simple policy that returns a fixed result for specific tools
function makeFixedPolicy(name: string, result: PolicyResult, forTools?: string[]): PermissionPolicy {
  return {
    name,
    async check(ctx: PolicyContext): Promise<PolicyResult> {
      if (forTools && !forTools.includes(ctx.toolName)) return "pass";
      return result;
    },
  };
}

// Helper: tracking policy that records calls
function makeTrackingPolicy(name: string, result: PolicyResult): {
  policy: PermissionPolicy;
  calls: PolicyContext[];
} {
  const calls: PolicyContext[] = [];
  return {
    calls,
    policy: {
      name,
      async check(ctx: PolicyContext): Promise<PolicyResult> {
        calls.push(ctx);
        return result;
      },
    },
  };
}

// ---- PolicyChain Tests ----

describe("PolicyChain", () => {
  test("deny short-circuits chain", async () => {
    const tracker = makeTrackingPolicy("tracker", "pass");
    const chain = new PolicyChain([
      makeFixedPolicy("denier", "deny", ["Bash"]),
      tracker.policy,
    ]);
    const result = await chain.run({
      toolName: "Bash",
      toolInput: { command: "ls" },
      sessionId: "test-1",
    });
    expect(result.decision).toBe("deny");
    expect(result.deniedBy).toBe("denier");
    expect(tracker.calls).toHaveLength(0);
  });

  test("allow short-circuits chain", async () => {
    const tracker = makeTrackingPolicy("tracker", "pass");
    const chain = new PolicyChain([
      makeFixedPolicy("allower", "allow", ["Read"]),
      tracker.policy,
    ]);
    const result = await chain.run({
      toolName: "Read",
      toolInput: { path: "/tmp" },
      sessionId: "test-2",
    });
    expect(result.decision).toBe("allow");
    expect(result.allowedBy).toBe("allower");
    expect(tracker.calls).toHaveLength(0);
  });

  test("all policies pass: result is pass", async () => {
    const chain = new PolicyChain([
      makeFixedPolicy("p1", "pass"),
      makeFixedPolicy("p2", "pass"),
    ]);
    const result = await chain.run({
      toolName: "Bash",
      toolInput: {},
      sessionId: "test-3",
    });
    expect(result.decision).toBe("pass");
    expect(result.deniedBy).toBeUndefined();
    expect(result.allowedBy).toBeUndefined();
  });

  test("empty chain returns pass", async () => {
    const chain = new PolicyChain([]);
    const result = await chain.run({
      toolName: "Bash",
      toolInput: {},
      sessionId: "test-4",
    });
    expect(result.decision).toBe("pass");
  });

  test("deny audit includes durationMs", async () => {
    const chain = new PolicyChain([
      makeFixedPolicy("denier", "deny", ["Bash"]),
    ]);
    const result = await chain.run({
      toolName: "Bash",
      toolInput: {},
      sessionId: "test-5",
    });
    expect(result.audits).toHaveLength(1);
    expect(result.audits[0].policyName).toBe("denier");
    expect(result.audits[0].decision).toBe("deny");
    expect(typeof result.audits[0].durationMs).toBe("number");
    expect(result.audits[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  test("allow audit includes durationMs", async () => {
    const chain = new PolicyChain([
      makeFixedPolicy("allower", "allow", ["Read"]),
    ]);
    const result = await chain.run({
      toolName: "Read",
      toolInput: {},
      sessionId: "test-6",
    });
    expect(result.audits).toHaveLength(1);
    expect(result.audits[0].decision).toBe("allow");
  });

  test("pass does not produce audit entry", async () => {
    const chain = new PolicyChain([
      makeFixedPolicy("passer", "pass"),
    ]);
    const result = await chain.run({
      toolName: "Bash",
      toolInput: {},
      sessionId: "test-7",
    });
    expect(result.audits).toHaveLength(0);
  });

  test("policies execute in registration order", async () => {
    const order: string[] = [];
    const p1: PermissionPolicy = {
      name: "first",
      async check(ctx) { order.push("first"); return "pass"; },
    };
    const p2: PermissionPolicy = {
      name: "second",
      async check(ctx) { order.push("second"); return "deny"; },
    };
    const p3: PermissionPolicy = {
      name: "third",
      async check(ctx) { order.push("third"); return "pass"; },
    };
    const chain = new PolicyChain([p1, p2, p3]);
    const result = await chain.run({
      toolName: "Bash",
      toolInput: {},
      sessionId: "test-8",
    });
    expect(result.decision).toBe("deny");
    expect(order).toEqual(["first", "second"]);
  });
});

// ---- Policy Registry Tests ----

describe("Policy Registry", () => {
  test("registerPolicy and hasPolicy", () => {
    const name = `test-policy-${Date.now()}`;
    registerPolicy(name, () => makeFixedPolicy(name, "pass"));
    expect(hasPolicy(name)).toBe(true);
    expect(hasPolicy("nonexistent")).toBe(false);
  });

  test("getRegisteredPolicyNames includes registered policy", () => {
    const name = `test-list-${Date.now()}`;
    registerPolicy(name, () => makeFixedPolicy(name, "pass"));
    const names = getRegisteredPolicyNames();
    expect(names).toContain(name);
  });

  test("resolvePolicies with valid descriptors", () => {
    const name = `test-resolve-${Date.now()}`;
    registerPolicy(name, (config) => ({
      name,
      async check() { return "pass" as PolicyResult; },
    }));
    const policies = resolvePolicies([{ name }]);
    expect(policies).toHaveLength(1);
    expect(policies[0].name).toBe(name);
  });

  test("resolvePolicies rejects unknown policy name", () => {
    expect(() => resolvePolicies([{ name: "nonexistent-policy-xyz" }])).toThrow(
      /Unknown policy: 'nonexistent-policy-xyz'/,
    );
  });

  test("resolvePolicies passes config to factory", () => {
    const name = `test-config-${Date.now()}`;
    let receivedConfig: Record<string, unknown> | undefined;
    registerPolicy(name, (config) => {
      receivedConfig = config;
      return makeFixedPolicy(name, "pass");
    });
    resolvePolicies([{ name, config: { key: "value" } }]);
    expect(receivedConfig).toEqual({ key: "value" });
  });
});

// ---- Bridge Integration Tests ----

import { BridgeServer } from "../src/bridge.js";
import type { JsonRpcResponse } from "../src/bridge.js";

function createBridge(): BridgeServer {
  return new BridgeServer({ sessionsDir: undefined, auditDir: undefined });
}

async function call(
  bridge: BridgeServer,
  method: string,
  params: Record<string, unknown> = {},
): Promise<JsonRpcResponse> {
  return bridge.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method,
    params,
  });
}

describe("Bridge: policy parameter validation", () => {
  const workspace = process.cwd();

  test("unknown policy name rejected with -32602", async () => {
    const bridge = createBridge();
    const resp = await call(bridge, "session.start", {
      workspace,
      prompt: "test",
      policies: [{ name: "nonexistent-policy-xyz" }],
    });
    expect(resp.error).toBeDefined();
    expect(resp.error!.code).toBe(-32602);
    expect(resp.error!.message).toContain("nonexistent-policy-xyz");
  });

  test("non-array policies rejected with -32602", async () => {
    const bridge = createBridge();
    const resp = await call(bridge, "session.start", {
      workspace,
      prompt: "test",
      policies: "not-an-array",
    });
    expect(resp.error).toBeDefined();
    expect(resp.error!.code).toBe(-32602);
    expect(resp.error!.message).toContain("policies");
  });

  test("policy descriptor without name rejected with -32602", async () => {
    const bridge = createBridge();
    const resp = await call(bridge, "session.start", {
      workspace,
      prompt: "test",
      policies: [{ config: {} }],
    });
    expect(resp.error).toBeDefined();
    expect(resp.error!.code).toBe(-32602);
  });

  test("session.start with valid registered policy passes validation", async () => {
    const policyName = `test-start-${Date.now()}`;
    registerPolicy(policyName, () => makeFixedPolicy(policyName, "pass"));

    const bridge = createBridge();
    // Validation happens before the query execution; an API key error means validation passed
    const resp = await call(bridge, "session.start", {
      workspace,
      prompt: "test",
      policies: [{ name: policyName }],
    });
    // Should NOT get a -32602 (validation error); a -32603 (API key) means validation passed
    expect(resp.error).toBeDefined();
    expect(resp.error!.code).not.toBe(-32602);
  });
});

describe("Bridge: permissions.policies.list", () => {
  const workspace = process.cwd();

  test("returns empty array for session without policies", async () => {
    const bridge = createBridge();
    const session = (bridge as unknown as { sessionStore: { create: (ws: string, p: string) => { id: string } } }).sessionStore.create(workspace, "test");
    const resp = await call(bridge, "permissions.policies.list", { sessionId: session.id });
    expect(resp.error).toBeUndefined();
    const result = resp.result as { policies: unknown[] };
    expect(result.policies).toEqual([]);
  });

  test("returns policy descriptors for session with policies", async () => {
    const policyName = `test-list-policies-${Date.now()}`;
    registerPolicy(policyName, () => makeFixedPolicy(policyName, "pass"));

    const bridge = createBridge();
    const session = (bridge as unknown as { sessionStore: { create: (ws: string, p: string) => { id: string; policies?: PolicyDescriptor[] } } }).sessionStore.create(workspace, "test");
    session.policies = [{ name: policyName }];
    const resp = await call(bridge, "permissions.policies.list", { sessionId: session.id });
    expect(resp.error).toBeUndefined();
    const result = resp.result as { policies: Array<{ name: string; config: unknown }> };
    expect(result.policies).toHaveLength(1);
    expect(result.policies[0].name).toBe(policyName);
    expect(result.policies[0].config).toBeNull();
  });

  test("returns policy with config when provided", async () => {
    const policyName = `test-list-config-${Date.now()}`;
    registerPolicy(policyName, () => makeFixedPolicy(policyName, "pass"));

    const bridge = createBridge();
    const session = (bridge as unknown as { sessionStore: { create: (ws: string, p: string) => { id: string; policies?: PolicyDescriptor[] } } }).sessionStore.create(workspace, "test");
    session.policies = [{ name: policyName, config: { allowedHours: "9-17" } }];
    const resp = await call(bridge, "permissions.policies.list", { sessionId: session.id });
    expect(resp.error).toBeUndefined();
    const result = resp.result as { policies: Array<{ name: string; config: unknown }> };
    expect(result.policies[0].config).toEqual({ allowedHours: "9-17" });
  });

  test("returns -32011 for unknown session", async () => {
    const bridge = createBridge();
    const resp = await call(bridge, "permissions.policies.list", {
      sessionId: "nonexistent-session",
    });
    expect(resp.error).toBeDefined();
    expect(resp.error!.code).toBe(-32011);
  });

  test("returns -32602 when sessionId not provided", async () => {
    const bridge = createBridge();
    const resp = await call(bridge, "permissions.policies.list", {});
    expect(resp.error).toBeDefined();
    expect(resp.error!.code).toBe(-32602);
  });
});
