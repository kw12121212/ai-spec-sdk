import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { checkScope, METHOD_SCOPES, verifyKey } from "../src/auth.js";
import type { StoredKey } from "../src/key-store.js";

function makeKey(overrides: Partial<StoredKey> = {}): StoredKey {
  return {
    id: "key-1",
    name: "test",
    hash: "known-hash",
    createdAt: "2026-03-30T00:00:00.000Z",
    scopes: ["session:read"],
    ...overrides,
  };
}

test("verifyKey returns null for an unknown token hash", () => {
  const key = makeKey({ hash: "different-hash" });
  const result = verifyKey("raw-token", [key]);
  assert.equal(result, null);
});

test("verifyKey returns null for an expired key", () => {
  const token = "expired-token";
  const expiredHash = crypto.createHash("sha256").update(token).digest("hex");
  const key = makeKey({
    hash: expiredHash,
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  });

  const result = verifyKey(token, [key]);
  assert.equal(result, null);
});

test("verifyKey returns null for a key with an invalid expiresAt timestamp", () => {
  const token = "invalid-expiry-token";
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const key = makeKey({
    hash,
    expiresAt: "not-a-date",
  });

  const result = verifyKey(token, [key]);
  assert.equal(result, null);
});

test("verifyKey returns the matching key for a valid unexpired token", () => {
  const token = "valid-token";
  const validHash = crypto.createHash("sha256").update(token).digest("hex");
  const key = makeKey({
    hash: validHash,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });

  const result = verifyKey(token, [key]);
  assert.deepEqual(result, key);
});

test("checkScope passes with a matching scope", () => {
  const key = makeKey({ scopes: ["session:write"] });
  assert.equal(checkScope(key, "session.start"), true);
});

test("checkScope passes with admin scope", () => {
  const key = makeKey({ scopes: ["admin"] });
  assert.equal(checkScope(key, "workflow.run"), true);
});

test("checkScope fails with insufficient scope", () => {
  const key = makeKey({ scopes: ["session:read"] });
  assert.equal(checkScope(key, "session.start"), false);
});

test("null-scope methods always pass authorization", () => {
  const key = makeKey({ scopes: [] });
  assert.equal(checkScope(key, "bridge.capabilities"), true);
  assert.equal(checkScope(key, "models.list"), true);
  assert.equal(checkScope(key, "tools.list"), true);
  assert.equal(checkScope(key, "skills.list"), true);
});

test("METHOD_SCOPES covers every bridge dispatch method", () => {
  const bridgeMethods = [
    "bridge.capabilities",
    "bridge.negotiateVersion",
    "bridge.setLogLevel",
    "bridge.ping",
    "skills.list",
    "workflow.run",
    "session.start",
    "session.resume",
    "session.stop",
    "session.status",
    "session.list",
    "session.history",
    "session.events",
    "models.list",
    "workspace.register",
    "workspace.list",
    "tools.list",
    "session.approveTool",
    "session.rejectTool",
    "mcp.add",
    "mcp.remove",
    "mcp.start",
    "mcp.stop",
    "mcp.list",
    "config.get",
    "config.set",
    "config.list",
    "hooks.add",
    "hooks.remove",
    "hooks.list",
    "context.read",
    "context.write",
    "context.list",
    "session.branch",
    "session.search",
    "session.export",
    "session.delete",
    "session.cleanup",
  ] as const;

  for (const method of bridgeMethods) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(METHOD_SCOPES, method),
      `METHOD_SCOPES is missing ${method}`,
    );
  }
});
