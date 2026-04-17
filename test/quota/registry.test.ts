import { test, expect } from "bun:test";
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
  expect(ok).toBe(true);
  expect(reg.size).toBe(1);
});

test("set() rejects duplicate quotaId", () => {
  const reg = createFreshRegistry();
  reg.set(validRule);
  const ok2 = reg.set(validRule);
  expect(ok2).toBe(false);
  expect(reg.size).toBe(1);
});

test("get() returns existing rule or null", () => {
  const reg = createFreshRegistry();
  reg.set(validRule);
  const got = reg.get("q1");
  expect(got).toBeTruthy();;
  expect(got!.quotaId).toBe("q1");

  const missing = reg.get("nonexistent");
  expect(missing).toBe(null);
});

test("list() returns all rules when no scope filter", () => {
  const reg = createFreshRegistry();
  reg.set(validRule);
  reg.set({ ...validRule, quotaId: "q2", scope: "global" });
  const all = reg.list();
  expect(all.length).toBe(2);
});

test("list() filters by scope", () => {
  const reg = createFreshRegistry();
  reg.set({ ...validRule, quotaId: "q1", scope: "session" });
  reg.set({ ...validRule, quotaId: "q2", scope: "global" });
  reg.set({ ...validRule, quotaId: "q3", scope: "provider", scopeId: "p1" });

  const sessionRules = reg.list("session");
  expect(sessionRules.length).toBe(1);
  expect(sessionRules[0].quotaId).toBe("q1");

  const globalRules = reg.list("global");
  expect(globalRules.length).toBe(1);

  const all = reg.list();
  expect(all.length).toBe(3);
});

test("remove() deletes a rule and returns true/false", () => {
  const reg = createFreshRegistry();
  reg.set(validRule);
  const removed = reg.remove("q1");
  expect(removed).toBe(true);
  expect(reg.get("q1")).toBe(null);
  expect(reg.size).toBe(0);

  const removedAgain = reg.remove("q1");
  expect(removedAgain).toBe(false);
});

test("clear() removes all rules and returns count", () => {
  const reg = createFreshRegistry();
  reg.set(validRule);
  reg.set({ ...validRule, quotaId: "q2" });
  const count = reg.clear();
  expect(count).toBe(2);
  expect(reg.size).toBe(0);
});

test("removeBySession() removes only session-scoped rules for that session", () => {
  const reg = createFreshRegistry();
  reg.set({ ...validRule, quotaId: "q1", scope: "session", scopeId: "s1" });
  reg.set({ ...validRule, quotaId: "q2", scope: "session", scopeId: "s2" });
  reg.set({ ...validRule, quotaId: "q3", scope: "global" });
  reg.set({ ...validRule, quotaId: "q4", scope: "provider", scopeId: "p1" });

  const removed = reg.removeBySession("s1");
  expect(removed).toBe(1);
  expect(reg.get("q1")).toBe(null);
  expect(reg.get("q2")?.quotaId).toBe("q2");
  expect(reg.get("q3")?.quotaId).toBe("q3");
  expect(reg.size).toBe(3);
});

test("getMatchingRules() matches by scope and scopeId", () => {
  const reg = createFreshRegistry();
  reg.set({ ...validRule, quotaId: "q-session-s1", scope: "session", scopeId: "s1" });
  reg.set({ ...validRule, quotaId: "q-session-s2", scope: "session", scopeId: "s2" });
  reg.set({ ...validRule, quotaId: "q-provider-p1", scope: "provider", scopeId: "p1" });
  reg.set({ ...validRule, quotaId: "q-global", scope: "global" });

  const matched = reg.getMatchingRules("s1", "p1");
  expect(matched.length).toBe(3);
  const ids = matched.map((r) => r.quotaId).sort();
  expect(ids).toEqual(["q-global", "q-provider-p1", "q-session-s1"]);
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
  expect(v.violationId.startsWith("qv-")).toBeTruthy();;
  expect(v.quotaId).toBe("q1");
  expect(v.blocked).toBe(true);

  const violations = reg.getViolations();
  expect(violations.length).toBe(1);
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
  expect(s1Violations.length).toBe(1);
  expect(s1Violations[0].sessionId).toBe("s1");

  const allViolations = reg.getViolations();
  expect(allViolations.length).toBe(2);
});

test("clearViolations() removes all violations", () => {
  const reg = createFreshRegistry();
  reg.recordViolation({
    quotaId: "q1", sessionId: "s1", providerId: "p1",
    timestamp: 1000, usageAtViolation: 500, limit: 1000, action: "block", blocked: true,
  });
  const count = reg.clearViolations();
  expect(count).toBe(1);
  expect(reg.getViolations().length).toBe(0);
});
