import test from "node:test";
import assert from "node:assert/strict";
import { QuotaRegistry, setQuotaRegistry } from "../../src/quota/registry.js";

function createFreshRegistry(): QuotaRegistry {
  const reg = new QuotaRegistry();
  setQuotaRegistry(reg);
  return reg;
}

const validRule = {
  quotaId: "q1",
  scope: "session" as const,
  scopeId: "s1",
  limit: 1000,
  action: "warn+block" as const,
  warnThreshold: 0.8,
};

test("set() stores a valid rule", () => {
  const reg = createFreshRegistry();
  const ok = reg.set(validRule);
  assert.equal(ok, true);
  assert.equal(reg.size, 1);
});

test("set() rejects duplicate quotaId", () => {
  const reg = createFreshRegistry();
  reg.set(validRule);
  const ok2 = reg.set(validRule);
  assert.equal(ok2, false);
  assert.equal(reg.size, 1);
});

test("get() returns existing rule or null", () => {
  const reg = createFreshRegistry();
  reg.set(validRule);
  const got = reg.get("q1");
  assert.ok(got);
  assert.equal(got!.quotaId, "q1");

  const missing = reg.get("nonexistent");
  assert.equal(missing, null);
});

test("list() returns all rules when no scope filter", () => {
  const reg = createFreshRegistry();
  reg.set(validRule);
  reg.set({ ...validRule, quotaId: "q2", scope: "global" });
  const all = reg.list();
  assert.equal(all.length, 2);
});

test("list() filters by scope", () => {
  const reg = createFreshRegistry();
  reg.set({ ...validRule, quotaId: "q1", scope: "session" });
  reg.set({ ...validRule, quotaId: "q2", scope: "global" });
  reg.set({ ...validRule, quotaId: "q3", scope: "provider", scopeId: "p1" });

  const sessionRules = reg.list("session");
  assert.equal(sessionRules.length, 1);
  assert.equal(sessionRules[0].quotaId, "q1");

  const globalRules = reg.list("global");
  assert.equal(globalRules.length, 1);

  const all = reg.list();
  assert.equal(all.length, 3);
});

test("remove() deletes a rule and returns true/false", () => {
  const reg = createFreshRegistry();
  reg.set(validRule);
  const removed = reg.remove("q1");
  assert.equal(removed, true);
  assert.equal(reg.get("q1"), null);
  assert.equal(reg.size, 0);

  const removedAgain = reg.remove("q1");
  assert.equal(removedAgain, false);
});

test("clear() removes all rules and returns count", () => {
  const reg = createFreshRegistry();
  reg.set(validRule);
  reg.set({ ...validRule, quotaId: "q2" });
  const count = reg.clear();
  assert.equal(count, 2);
  assert.equal(reg.size, 0);
});

test("removeBySession() removes only session-scoped rules for that session", () => {
  const reg = createFreshRegistry();
  reg.set({ ...validRule, quotaId: "q1", scope: "session", scopeId: "s1" });
  reg.set({ ...validRule, quotaId: "q2", scope: "session", scopeId: "s2" });
  reg.set({ ...validRule, quotaId: "q3", scope: "global" });
  reg.set({ ...validRule, quotaId: "q4", scope: "provider", scopeId: "p1" });

  const removed = reg.removeBySession("s1");
  assert.equal(removed, 1);
  assert.equal(reg.get("q1"), null);
  assert.equal(reg.get("q2")?.quotaId, "q2");
  assert.equal(reg.get("q3")?.quotaId, "q3");
  assert.equal(reg.size, 3);
});

test("getMatchingRules() matches by scope and scopeId", () => {
  const reg = createFreshRegistry();
  reg.set({ ...validRule, quotaId: "q-session-s1", scope: "session", scopeId: "s1" });
  reg.set({ ...validRule, quotaId: "q-session-s2", scope: "session", scopeId: "s2" });
  reg.set({ ...validRule, quotaId: "q-provider-p1", scope: "provider", scopeId: "p1" });
  reg.set({ ...validRule, quotaId: "q-global", scope: "global" });

  const matched = reg.getMatchingRules("s1", "p1");
  assert.equal(matched.length, 3);
  const ids = matched.map((r) => r.quotaId).sort();
  assert.deepEqual(ids, ["q-global", "q-provider-p1", "q-session-s1"]);
});

test("recordViolation() stores violation with auto-generated id", () => {
  const reg = createFreshRegistry();
  const v = reg.recordViolation({
    quotaId: "q1",
    sessionId: "s1",
    providerId: "p1",
    timestamp: 1000,
    usageAtViolation: 1100,
    limit: 1000,
    action: "block",
    blocked: true,
  });
  assert.ok(v.violationId.startsWith("qv-"));
  assert.equal(v.quotaId, "q1");
  assert.equal(v.blocked, true);

  const violations = reg.getViolations();
  assert.equal(violations.length, 1);
});

test("getViolations() filters by sessionId", () => {
  const reg = createFreshRegistry();
  reg.recordViolation({
    quotaId: "q1", sessionId: "s1", providerId: "p1",
    timestamp: 1000, usageAtViolation: 500, limit: 1000, action: "block", blocked: true,
  });
  reg.recordViolation({
    quotaId: "q1", sessionId: "s2", providerId: "p1",
    timestamp: 2000, usageAtViolation: 600, limit: 1000, action: "block", blocked: true,
  });

  const s1Violations = reg.getViolations("s1");
  assert.equal(s1Violations.length, 1);
  assert.equal(s1Violations[0].sessionId, "s1");

  const allViolations = reg.getViolations();
  assert.equal(allViolations.length, 2);
});

test("clearViolations() removes all violations", () => {
  const reg = createFreshRegistry();
  reg.recordViolation({
    quotaId: "q1", sessionId: "s1", providerId: "p1",
    timestamp: 1000, usageAtViolation: 500, limit: 1000, action: "block", blocked: true,
  });
  const count = reg.clearViolations();
  assert.equal(count, 1);
  assert.equal(reg.getViolations().length, 0);
});
