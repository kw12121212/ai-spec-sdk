import { test, expect } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { TemplateStore } from "../src/template-store.js";

test("TemplateStore with templatesDir writes template to disk on create", () => {
  const templatesDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-templates-"));

  try {
    const store = new TemplateStore(templatesDir);
    const template = store.create({
      name: "test-template",
      model: "claude-3-opus",
      maxTurns: 10,
    });

    const filePath = path.join(templatesDir, "test-template.json");
    expect(fs.existsSync(filePath)).toBeTruthy();

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
    expect(parsed["name"]).toBe("test-template");
    expect(parsed["model"]).toBe("claude-3-opus");
    expect(parsed["maxTurns"]).toBe(10);
  } finally {
    fs.rmSync(templatesDir, { recursive: true, force: true });
  }
});

test("TemplateStore with templatesDir reloads templates from disk on construction", () => {
  const templatesDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-templates-reload-"));

  try {
    // Create template in first store instance
    const store1 = new TemplateStore(templatesDir);
    store1.create({
      name: "persisted-template",
      model: "claude-3-sonnet",
      systemPrompt: "You are a helpful assistant",
    });

    // New instance reads from disk
    const store2 = new TemplateStore(templatesDir);
    const loaded = store2.get("persisted-template");

    expect(loaded).toBeTruthy();
    expect(loaded!.name).toBe("persisted-template");
    expect(loaded!.model).toBe("claude-3-sonnet");
    expect(loaded!.systemPrompt).toBe("You are a helpful assistant");
  } finally {
    fs.rmSync(templatesDir, { recursive: true, force: true });
  }
});

test("TemplateStore creates templatesDir if it does not exist", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-templates-mkdir-"));
  const templatesDir = path.join(parent, "templates", "nested");

  try {
    expect(!fs.existsSync(templatesDir)).toBeTruthy();
    new TemplateStore(templatesDir);
    expect(fs.existsSync(templatesDir)).toBeTruthy();
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("TemplateStore without templatesDir does not write files", () => {
  const store = new TemplateStore();
  const template = store.create({
    name: "memory-only",
    model: "claude-3-haiku",
  });

  // Should not throw and template should be in memory
  expect(store.get("memory-only")).toBeTruthy();
  expect(template.name).toBe("memory-only");
});

test("TemplateStore get returns null for non-existent template", () => {
  const store = new TemplateStore();
  const result = store.get("does-not-exist");
  expect(result).toBe(null);
});

test("TemplateStore list returns all templates sorted by name", () => {
  const store = new TemplateStore();

  store.create({ name: "zebra-template", model: "claude-3-opus" });
  store.create({ name: "alpha-template", model: "claude-3-sonnet" });
  store.create({ name: "beta-template", model: "claude-3-haiku" });

  const list = store.list();
  expect(list.length).toBe(3);
  expect(list[0].name).toBe("alpha-template");
  expect(list[1].name).toBe("beta-template");
  expect(list[2].name).toBe("zebra-template");
});

test("TemplateStore delete removes template", () => {
  const templatesDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-templates-delete-"));

  try {
    const store = new TemplateStore(templatesDir);
    store.create({ name: "to-delete", model: "claude-3-opus" });

    expect(store.get("to-delete")).toBeTruthy();

    const removed = store.delete("to-delete");
    expect(removed).toBe(true);
    expect(store.get("to-delete")).toBe(null);

    const filePath = path.join(templatesDir, "to-delete.json");
    expect(!fs.existsSync(filePath)).toBeTruthy();
  } finally {
    fs.rmSync(templatesDir, { recursive: true, force: true });
  }
});

test("TemplateStore delete returns false for non-existent template", () => {
  const store = new TemplateStore();
  const removed = store.delete("never-existed");
  expect(removed).toBe(false);
});

test("TemplateStore create updates existing template (upsert)", () => {
  const store = new TemplateStore();

  const template1 = store.create({
    name: "upsert-test",
    model: "claude-3-opus",
    maxTurns: 5,
  });
  const createdAt = template1.createdAt;

  const template2 = store.create({
    name: "upsert-test",
    model: "claude-3-sonnet",
    systemPrompt: "New prompt",
  });

  expect(template2.name).toBe("upsert-test");
  expect(template2.model).toBe("claude-3-sonnet");
  expect(template2.maxTurns).toBe(undefined);
  expect(template2.systemPrompt).toBe("New prompt");
  expect(template2.createdAt).toBe(createdAt);
  expect(template2.updatedAt >= template1.updatedAt).toBeTruthy();
});

test("TemplateStore create sets createdAt and updatedAt timestamps", () => {
  const store = new TemplateStore();
  const before = new Date().toISOString();

  const template = store.create({ name: "timestamp-test" });

  const after = new Date().toISOString();
  expect(template.createdAt >= before).toBeTruthy();
  expect(template.createdAt <= after).toBeTruthy();
  expect(template.createdAt).toBe(template.updatedAt);
});
