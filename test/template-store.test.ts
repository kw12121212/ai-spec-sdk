import test from "node:test";
import assert from "node:assert/strict";
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
    assert.ok(fs.existsSync(filePath), "template file should exist on disk");

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
    assert.equal(parsed["name"], "test-template");
    assert.equal(parsed["model"], "claude-3-opus");
    assert.equal(parsed["maxTurns"], 10);
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

    assert.ok(loaded, "template should be reloaded from disk");
    assert.equal(loaded!.name, "persisted-template");
    assert.equal(loaded!.model, "claude-3-sonnet");
    assert.equal(loaded!.systemPrompt, "You are a helpful assistant");
  } finally {
    fs.rmSync(templatesDir, { recursive: true, force: true });
  }
});

test("TemplateStore creates templatesDir if it does not exist", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-templates-mkdir-"));
  const templatesDir = path.join(parent, "templates", "nested");

  try {
    assert.ok(!fs.existsSync(templatesDir), "directory should not exist before construction");
    new TemplateStore(templatesDir);
    assert.ok(fs.existsSync(templatesDir), "TemplateStore must create the directory on construction");
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
  assert.ok(store.get("memory-only"));
  assert.equal(template.name, "memory-only");
});

test("TemplateStore get returns null for non-existent template", () => {
  const store = new TemplateStore();
  const result = store.get("does-not-exist");
  assert.equal(result, null);
});

test("TemplateStore list returns all templates sorted by name", () => {
  const store = new TemplateStore();

  store.create({ name: "zebra-template", model: "claude-3-opus" });
  store.create({ name: "alpha-template", model: "claude-3-sonnet" });
  store.create({ name: "beta-template", model: "claude-3-haiku" });

  const list = store.list();
  assert.equal(list.length, 3);
  assert.equal(list[0].name, "alpha-template");
  assert.equal(list[1].name, "beta-template");
  assert.equal(list[2].name, "zebra-template");
});

test("TemplateStore delete removes template", () => {
  const templatesDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-templates-delete-"));

  try {
    const store = new TemplateStore(templatesDir);
    store.create({ name: "to-delete", model: "claude-3-opus" });

    assert.ok(store.get("to-delete"), "template should exist before delete");

    const removed = store.delete("to-delete");
    assert.equal(removed, true);
    assert.equal(store.get("to-delete"), null);

    const filePath = path.join(templatesDir, "to-delete.json");
    assert.ok(!fs.existsSync(filePath), "template file should be removed from disk");
  } finally {
    fs.rmSync(templatesDir, { recursive: true, force: true });
  }
});

test("TemplateStore delete returns false for non-existent template", () => {
  const store = new TemplateStore();
  const removed = store.delete("never-existed");
  assert.equal(removed, false);
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

  assert.equal(template2.name, "upsert-test");
  assert.equal(template2.model, "claude-3-sonnet");
  assert.equal(template2.maxTurns, undefined);
  assert.equal(template2.systemPrompt, "New prompt");
  assert.equal(template2.createdAt, createdAt, "createdAt should be preserved");
  assert.ok(template2.updatedAt >= template1.updatedAt, "updatedAt should be updated");
});

test("TemplateStore create sets createdAt and updatedAt timestamps", () => {
  const store = new TemplateStore();
  const before = new Date().toISOString();

  const template = store.create({ name: "timestamp-test" });

  const after = new Date().toISOString();
  assert.ok(template.createdAt >= before, "createdAt should be set");
  assert.ok(template.createdAt <= after, "createdAt should be set");
  assert.equal(template.createdAt, template.updatedAt, "createdAt and updatedAt should be equal on create");
});
