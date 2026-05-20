import { test, expect } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { getCapabilities } from "../src/capabilities.js";
import { METHOD_SCOPES } from "../src/auth.js";

const ROOT = path.resolve(import.meta.dir, "..");

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function diff(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((item) => !rightSet.has(item));
}

function readDispatchMethods(): string[] {
  const source = fs.readFileSync(path.join(ROOT, "src", "bridge.ts"), "utf8");
  const dispatch = source.match(/switch \(method\) \{([\s\S]*?)\n      default:/);
  expect(dispatch, "dispatch switch not found").toBeTruthy();
  return [...dispatch![1]!.matchAll(/case "([^"]+)":/g)].map((match) => match[1]!);
}

function readContract(): Record<string, unknown> {
  return yaml.load(fs.readFileSync(path.join(ROOT, "docs", "bridge-contract.yaml"), "utf8")) as Record<string, unknown>;
}

test("bridge.capabilities advertises every callable dispatch method exactly once", () => {
  const dispatchMethods = readDispatchMethods();
  const capabilityMethods = getCapabilities().methods;

  expect(diff(dispatchMethods, capabilityMethods), "capabilities missing dispatch methods").toEqual([]);
  expect(diff(capabilityMethods, dispatchMethods), "capabilities advertise non-dispatch methods").toEqual([]);
  expect(unique(capabilityMethods).length, "capability methods must be unique").toBe(capabilityMethods.length);
});

test("HTTP auth scopes explicitly classify every callable dispatch method", () => {
  const dispatchMethods = readDispatchMethods();
  const scopeMethods = Object.keys(METHOD_SCOPES);

  expect(diff(dispatchMethods, scopeMethods), "METHOD_SCOPES missing dispatch methods").toEqual([]);
  expect(diff(scopeMethods, dispatchMethods), "METHOD_SCOPES has non-dispatch methods").toEqual([]);
});

test("bridge contract covers every advertised method and auth scope", () => {
  const contract = readContract();
  const methods = contract["methods"] as Record<string, unknown>;
  const authentication = contract["authentication"] as Record<string, unknown>;
  const scopeTable = authentication["scope_table"] as Record<string, unknown>;
  const capabilityMethods = getCapabilities().methods;

  expect(diff(capabilityMethods, Object.keys(methods)), "contract missing capability methods").toEqual([]);
  expect(diff(Object.keys(methods), capabilityMethods), "contract contains non-capability methods").toEqual([]);
  expect(diff(capabilityMethods, Object.keys(scopeTable)), "contract scope table missing capability methods").toEqual([]);
  expect(diff(Object.keys(scopeTable), capabilityMethods), "contract scope table contains non-capability methods").toEqual([]);

  for (const method of capabilityMethods) {
    const expected = METHOD_SCOPES[method] ?? null;
    const actual = scopeTable[method] ?? null;
    expect(actual, `contract auth scope drift for ${method}`).toBe(expected);
  }
});

test("bridge contract has one non-duplicated top-level section set", () => {
  const text = fs.readFileSync(path.join(ROOT, "docs", "bridge-contract.yaml"), "utf8");
  const expectedSections = [
    "contract",
    "transport",
    "startup",
    "environment",
    "envelope",
    "notifications",
    "error_codes",
    "authentication",
    "capabilities",
    "methods",
  ];

  for (const section of expectedSections) {
    const matches = text.match(new RegExp(`^${section}:`, "gm")) ?? [];
    expect(matches.length, `top-level section '${section}' must occur once`).toBe(1);
  }
});
