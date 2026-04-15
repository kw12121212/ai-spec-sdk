import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  resolveScopes,
  getAllScopes,
  getToolMapping,
  validateScopeStrings,
  isScopeDenied,
} from "../src/permission-scopes.js";
import { registerPolicy } from "../src/permission-policy.js";

// ---- Scope Resolution Tests ----

describe("resolveScopes", () => {
  test("Bash resolves to system", () => {
    expect(resolveScopes("Bash")).toEqual(["system"]);
  });

  test("Read resolves to file:read", () => {
    expect(resolveScopes("Read")).toEqual(["file:read"]);
  });

  test("Write resolves to file:write", () => {
    expect(resolveScopes("Write")).toEqual(["file:write"]);
  });

  test("Edit resolves to file:write", () => {
    expect(resolveScopes("Edit")).toEqual(["file:write"]);
  });

  test("MultiEdit resolves to file:write", () => {
    expect(resolveScopes("MultiEdit")).toEqual(["file:write"]);
  });

  test("Glob resolves to file:read", () => {
    expect(resolveScopes("Glob")).toEqual(["file:read"]);
  });

  test("Grep resolves to file:read", () => {
    expect(resolveScopes("Grep")).toEqual(["file:read"]);
  });

  test("LS resolves to file:read", () => {
    expect(resolveScopes("LS")).toEqual(["file:read"]);
  });

  test("WebFetch resolves to network", () => {
    expect(resolveScopes("WebFetch")).toEqual(["network"]);
  });

  test("WebSearch resolves to network", () => {
    expect(resolveScopes("WebSearch")).toEqual(["network"]);
  });

  test("TodoRead resolves to task", () => {
    expect(resolveScopes("TodoRead")).toEqual(["task"]);
  });

  test("TodoWrite resolves to task", () => {
    expect(resolveScopes("TodoWrite")).toEqual(["task"]);
  });

  test("NotebookRead resolves to notebook:read", () => {
    expect(resolveScopes("NotebookRead")).toEqual(["notebook:read"]);
  });

  test("NotebookEdit resolves to notebook:write", () => {
    expect(resolveScopes("NotebookEdit")).toEqual(["notebook:write"]);
  });

  test("custom tools resolve to system", () => {
    expect(resolveScopes("custom.my_tool")).toEqual(["system"]);
  });

  test("unknown tools resolve to system as default", () => {
    expect(resolveScopes("NonExistent")).toEqual(["system"]);
  });
});

// ---- getAllScopes / getToolMapping Tests ----

describe("getAllScopes", () => {
  test("returns all 7 scope names", () => {
    const scopes = getAllScopes();
    expect(scopes).toHaveLength(7);
    expect(scopes).toContain("file:read");
    expect(scopes).toContain("file:write");
    expect(scopes).toContain("network");
    expect(scopes).toContain("system");
    expect(scopes).toContain("task");
    expect(scopes).toContain("notebook:read");
    expect(scopes).toContain("notebook:write");
  });
});

describe("getToolMapping", () => {
  test("returns mapping for all 14 built-in tools", () => {
    const mapping = getToolMapping();
    expect(mapping.size).toBe(14);
  });
});

// ---- validateScopeStrings Tests ----

describe("validateScopeStrings", () => {
  test("valid scope strings pass", () => {
    expect(() => validateScopeStrings(["file:read", "network"], "allowedScopes")).not.toThrow();
  });

  test("invalid scope string throws", () => {
    expect(() => validateScopeStrings(["invalid_scope"], "allowedScopes")).toThrow(
      /Invalid allowedScopes value 'invalid_scope'/,
    );
  });

  test("error message lists valid scope names", () => {
    try {
      validateScopeStrings(["bad"], "test");
    } catch (err) {
      expect((err as Error).message).toContain("file:read");
      expect((err as Error).message).toContain("system");
    }
  });
});

// ---- isScopeDenied Tests ----

describe("isScopeDenied", () => {
  test("no restrictions: tool allowed", () => {
    expect(isScopeDenied("Bash", {})).toEqual({ denied: false });
  });

  test("no restrictions: undefined arrays", () => {
    expect(isScopeDenied("Read", { allowedScopes: undefined, blockedScopes: undefined })).toEqual({ denied: false });
  });

  test("tool allowed by scope", () => {
    expect(isScopeDenied("Read", { allowedScopes: ["file:read"] })).toEqual({ denied: false });
  });

  test("tool blocked by scope", () => {
    const result = isScopeDenied("Write", { allowedScopes: ["file:read"] });
    expect(result.denied).toBe(true);
    if (result.denied) {
      expect(result.requiredScopes).toEqual(["file:write"]);
    }
  });

  test("blocked scope takes precedence over allowed", () => {
    const result = isScopeDenied("Write", {
      allowedScopes: ["file:read", "file:write"],
      blockedScopes: ["file:write"],
    });
    expect(result.denied).toBe(true);
  });

  test("blocked scope blocks even without allowedScopes", () => {
    const result = isScopeDenied("Bash", { blockedScopes: ["system"] });
    expect(result.denied).toBe(true);
  });

  test("tool not in allowed list is denied", () => {
    const result = isScopeDenied("Bash", { allowedScopes: ["file:read"] });
    expect(result.denied).toBe(true);
  });

  test("all scopes allowed", () => {
    expect(isScopeDenied("Bash", {
      allowedScopes: ["file:read", "file:write", "network", "system", "task", "notebook:read", "notebook:write"],
    })).toEqual({ denied: false });
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

describe("Bridge: permissions.scopes", () => {
  test("returns all scope names and tool mappings", async () => {
    const bridge = createBridge();
    const resp = await call(bridge, "permissions.scopes");
    expect(resp.error).toBeUndefined();
    expect(resp.result).toBeDefined();
    const result = resp.result as { scopes: string[]; toolMapping: Record<string, string[]> };
    expect(result.scopes).toHaveLength(7);
    expect(result.scopes).toContain("file:read");
    expect(result.scopes).toContain("system");
    expect(result.toolMapping["Bash"]).toEqual(["system"]);
    expect(result.toolMapping["Read"]).toEqual(["file:read"]);
    expect(Object.keys(result.toolMapping)).toHaveLength(14);
  });
});

describe("Bridge: session.start scope parameter validation", () => {
  const workspace = process.cwd();

  test("invalid scope string in allowedScopes rejected with -32602", async () => {
    const bridge = createBridge();
    const resp = await call(bridge, "session.start", {
      workspace,
      prompt: "test",
      allowedScopes: ["invalid_scope"],
    });
    expect(resp.error).toBeDefined();
    expect(resp.error!.code).toBe(-32602);
    expect(resp.error!.message).toContain("invalid_scope");
  });

  test("invalid scope string in blockedScopes rejected with -32602", async () => {
    const bridge = createBridge();
    const resp = await call(bridge, "session.start", {
      workspace,
      prompt: "test",
      blockedScopes: ["nope"],
    });
    expect(resp.error).toBeDefined();
    expect(resp.error!.code).toBe(-32602);
    expect(resp.error!.message).toContain("nope");
  });

  test("non-array allowedScopes rejected with -32602", async () => {
    const bridge = createBridge();
    const resp = await call(bridge, "session.start", {
      workspace,
      prompt: "test",
      allowedScopes: "file:read",
    });
    expect(resp.error).toBeDefined();
    expect(resp.error!.code).toBe(-32602);
  });
});

describe("Bridge: template scope support", () => {
  let bridge: BridgeServer;

  beforeEach(() => {
    bridge = createBridge();
  });

  function beforeEach(fn: () => void) {
    fn();
  }

  test("template.create with allowedScopes", async () => {
    bridge = createBridge();
    const resp = await call(bridge, "template.create", {
      name: "readonly",
      allowedScopes: ["file:read"],
    });
    expect(resp.error).toBeUndefined();
    const result = resp.result as { allowedScopes?: string[] };
    expect(result.allowedScopes).toEqual(["file:read"]);
  });

  test("template.create with blockedScopes", async () => {
    bridge = createBridge();
    const resp = await call(bridge, "template.create", {
      name: "no-network",
      blockedScopes: ["network"],
    });
    expect(resp.error).toBeUndefined();
    const result = resp.result as { blockedScopes?: string[] };
    expect(result.blockedScopes).toEqual(["network"]);
  });

  test("template.get returns scope fields", async () => {
    bridge = createBridge();
    await call(bridge, "template.create", {
      name: "readonly2",
      allowedScopes: ["file:read", "task"],
    });
    const resp = await call(bridge, "template.get", { name: "readonly2" });
    expect(resp.error).toBeUndefined();
    const result = resp.result as { allowedScopes?: string[] };
    expect(result.allowedScopes).toEqual(["file:read", "task"]);
  });

  test("template with both allowedScopes and blockedScopes", async () => {
    bridge = createBridge();
    const resp = await call(bridge, "template.create", {
      name: "mixed",
      allowedScopes: ["file:read", "file:write"],
      blockedScopes: ["network"],
    });
    expect(resp.error).toBeUndefined();
    const result = resp.result as { allowedScopes?: string[]; blockedScopes?: string[] };
    expect(result.allowedScopes).toEqual(["file:read", "file:write"]);
    expect(result.blockedScopes).toEqual(["network"]);
  });

  test("invalid scope in template rejected", async () => {
    bridge = createBridge();
    const resp = await call(bridge, "template.create", {
      name: "bad-tpl",
      allowedScopes: ["invalid"],
    });
    expect(resp.error).toBeDefined();
    expect(resp.error!.code).toBe(-32602);
  });

  test("template without scope params works normally", async () => {
    bridge = createBridge();
    const resp = await call(bridge, "template.create", {
      name: "plain",
      model: "claude-sonnet-4-6",
    });
    expect(resp.error).toBeUndefined();
    const result = resp.result as { name: string; allowedScopes?: string[]; blockedScopes?: string[] };
    expect(result.name).toBe("plain");
    expect(result.allowedScopes).toBeUndefined();
    expect(result.blockedScopes).toBeUndefined();
  });
});

describe("Bridge: session.spawn inheritance", () => {
  const workspace = process.cwd();
  let fallbackMock: any;
  let originalKey: string | undefined;

  beforeAll(() => {
    originalKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    fallbackMock = (globalThis as any).__AI_SPEC_SDK_QUERY__;
    (globalThis as any).__AI_SPEC_SDK_QUERY__ = async function* () {
      yield { type: "system", subtype: "init", session_id: "test-sdk" };
      yield { result: "done" };
    };

    registerPolicy("some-parent-policy", () => ({
      name: "some-parent-policy",
      async check() { return "pass"; }
    }));
    registerPolicy("some-child-policy", () => ({
      name: "some-child-policy",
      async check() { return "pass"; }
    }));
  });

  afterAll(() => {
    (globalThis as any).__AI_SPEC_SDK_QUERY__ = fallbackMock;
    if (originalKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });

  test("child inherits parent allowedScopes when none requested", async () => {
    const bridge = createBridge();
    const parentResp = await call(bridge, "session.start", {
      workspace,
      prompt: "parent",
      allowedScopes: ["file:read", "file:write"]
    });
    const parentId = (parentResp.result as Record<string, unknown>).sessionId as string;

    const childResp = await call(bridge, "session.spawn", {
      parentSessionId: parentId,
      prompt: "child"
    });
    expect(childResp.error).toBeUndefined();
    const childId = (childResp.result as Record<string, unknown>).sessionId as string;

    const statusResp = await call(bridge, "session.status", { sessionId: childId });
    const status = statusResp.result as Record<string, unknown>;
    expect(status.allowedScopes).toEqual(["file:read", "file:write"]);
  });

  test("child can request a subset of parent allowedScopes", async () => {
    const bridge = createBridge();
    const parentResp = await call(bridge, "session.start", {
      workspace,
      prompt: "parent",
      allowedScopes: ["file:read", "file:write", "network"]
    });
    const parentId = (parentResp.result as Record<string, unknown>).sessionId as string;

    const childResp = await call(bridge, "session.spawn", {
      parentSessionId: parentId,
      prompt: "child",
      allowedScopes: ["file:read"]
    });
    expect(childResp.error).toBeUndefined();
    const childId = (childResp.result as Record<string, unknown>).sessionId as string;

    const statusResp = await call(bridge, "session.status", { sessionId: childId });
    const status = statusResp.result as Record<string, unknown>;
    expect(status.allowedScopes).toEqual(["file:read"]);
  });

  test("-32602 error thrown when child requests allowedScopes exceeding parent", async () => {
    const bridge = createBridge();
    const parentResp = await call(bridge, "session.start", {
      workspace,
      prompt: "parent",
      allowedScopes: ["file:read"]
    });
    const parentId = (parentResp.result as Record<string, unknown>).sessionId as string;

    const childResp = await call(bridge, "session.spawn", {
      parentSessionId: parentId,
      prompt: "child",
      allowedScopes: ["file:write"]
    });
    expect(childResp.error).toBeDefined();
    expect(childResp.error!.code).toBe(-32602);
    expect(childResp.error!.message).toContain("exceed parent allowedScopes");
  });

  test("blockedScopes are unioned between parent and child", async () => {
    const bridge = createBridge();
    const parentResp = await call(bridge, "session.start", {
      workspace,
      prompt: "parent",
      blockedScopes: ["network"]
    });
    const parentId = (parentResp.result as Record<string, unknown>).sessionId as string;

    const childResp = await call(bridge, "session.spawn", {
      parentSessionId: parentId,
      prompt: "child",
      blockedScopes: ["system"]
    });
    expect(childResp.error).toBeUndefined();
    const childId = (childResp.result as Record<string, unknown>).sessionId as string;

    const statusResp = await call(bridge, "session.status", { sessionId: childId });
    const status = statusResp.result as Record<string, unknown>;
    expect(status.blockedScopes).toContain("network");
    expect(status.blockedScopes).toContain("system");
    expect((status.blockedScopes as string[]).length).toBe(2);
  });

  test("parent policies execute before child policies", async () => {
    const bridge = createBridge();
    const parentResp = await call(bridge, "session.start", {
      workspace,
      prompt: "parent",
      policies: [{ name: "some-parent-policy" }]
    });
    const parentId = (parentResp.result as Record<string, unknown>).sessionId as string;

    const childResp = await call(bridge, "session.spawn", {
      parentSessionId: parentId,
      prompt: "child",
      policies: [{ name: "some-child-policy" }]
    });
    expect(childResp.error).toBeUndefined();
    const childId = (childResp.result as Record<string, unknown>).sessionId as string;

    const statusResp = await call(bridge, "session.status", { sessionId: childId });
    const status = statusResp.result as Record<string, unknown>;
    const policies = status.policies as Array<{ name: string }>;
    expect(policies).toBeDefined();
    expect(policies[0].name).toBe("some-parent-policy");
    expect(policies[1].name).toBe("some-child-policy");
  });
});
