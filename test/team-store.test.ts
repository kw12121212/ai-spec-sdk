import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { TeamStore } from "../src/team-store.js";

test("TeamStore create returns team with creator as owner", () => {
  const store = new TeamStore();
  const team = store.create({ name: "engineering" });

  assert.equal(team.name, "engineering");
  assert.equal(team.version, 1);
  assert.equal(team.members.length, 1);
  assert.equal(team.members[0].userId, "creator");
  assert.equal(team.members[0].role, "owner");
  assert.equal(team.workspaces.length, 0);
  assert.ok(typeof team.createdAt === "string");
  assert.ok(typeof team.updatedAt === "string");
});

test("TeamStore create with initial members and workspaces", () => {
  const store = new TeamStore();
  const team = store.create({
    name: "platform",
    description: "Platform team",
    members: [
      { userId: "alice", role: "admin" },
      { userId: "bob", role: "member" },
    ],
    workspaces: ["/projects/platform", "/projects/infra"],
  });

  assert.equal(team.members.length, 3);
  assert.equal(team.members[0].userId, "creator");
  assert.equal(team.members[0].role, "owner");
  assert.equal(team.members[1].userId, "alice");
  assert.equal(team.members[1].role, "admin");
  assert.equal(team.members[2].userId, "bob");
  assert.equal(team.members[2].role, "member");
  assert.deepEqual(team.workspaces, ["/projects/platform", "/projects/infra"]);
  assert.equal(team.description, "Platform team");
});

test("TeamStore create rejects duplicate name", () => {
  const store = new TeamStore();
  store.create({ name: "eng" });
  assert.throws(() => store.create({ name: "eng" }), /already exists/);
});

test("TeamStore get returns team or null", () => {
  const store = new TeamStore();
  store.create({ name: "found" });
  assert.equal(store.get("found")!.name, "found");
  assert.equal(store.get("missing"), null);
});

test("TeamStore update changes description and workspaces", () => {
  const store = new TeamStore();
  store.create({ name: "dev", description: "old" });

  const updated = store.update({ name: "dev", description: "new", workspaces: ["/a"] });
  assert.equal(updated.description, "new");
  assert.deepEqual(updated.workspaces, ["/a"]);
  assert.equal(updated.version, 2);
});

test("TeamStore update preserves fields not provided", () => {
  const store = new TeamStore();
  store.create({ name: "keep", description: "original", workspaces: ["/x"] });

  const updated = store.update({ name: "keep", description: "changed" });
  assert.equal(updated.description, "changed");
  assert.deepEqual(updated.workspaces, ["/x"]);
});

test("TeamStore update rejects non-existent team", () => {
  const store = new TeamStore();
  assert.throws(() => store.update({ name: "nope" }), /not found/);
});

test("TeamStore list returns teams sorted by name", () => {
  const store = new TeamStore();
  store.create({ name: "zebra" });
  store.create({ name: "alpha" });
  store.create({ name: "mid" });

  const list = store.list();
  assert.equal(list.length, 3);
  assert.equal(list[0].name, "alpha");
  assert.equal(list[1].name, "mid");
  assert.equal(list[2].name, "zebra");
});

test("TeamStore delete removes team", () => {
  const store = new TeamStore();
  store.create({ name: "gone" });
  assert.equal(store.delete("gone"), true);
  assert.equal(store.get("gone"), null);
  assert.equal(store.delete("gone"), false);
});

test("TeamStore addMember adds a new member", () => {
  const store = new TeamStore();
  store.create({ name: "team" });

  const team = store.addMember("team", "charlie", "member");
  assert.equal(team.members.length, 2);
  assert.equal(team.members[1].userId, "charlie");
  assert.equal(team.members[1].role, "member");
});

test("TeamStore addMember rejects duplicate member", () => {
  const store = new TeamStore();
  store.create({ name: "team" });
  store.addMember("team", "alice", "admin");
  assert.throws(() => store.addMember("team", "alice", "member"), /already exists/);
});

test("TeamStore addMember rejects invalid role", () => {
  const store = new TeamStore();
  store.create({ name: "team" });
  assert.throws(() => store.addMember("team", "x", "superuser" as any), /Invalid role/);
});

test("TeamStore addMember rejects non-existent team", () => {
  const store = new TeamStore();
  assert.throws(() => store.addMember("nope", "x", "member"), /not found/);
});

test("TeamStore removeMember removes a member", () => {
  const store = new TeamStore();
  store.create({ name: "team" });
  store.addMember("team", "bob", "member");

  const team = store.removeMember("team", "bob");
  assert.equal(team.members.length, 1);
  assert.equal(team.members[0].userId, "creator");
});

test("TeamStore removeMember rejects non-existent member", () => {
  const store = new TeamStore();
  store.create({ name: "team" });
  assert.throws(() => store.removeMember("team", "nobody"), /not found/);
});

test("TeamStore removeMember rejects non-existent team", () => {
  const store = new TeamStore();
  assert.throws(() => store.removeMember("nope", "x"), /not found/);
});

test("TeamStore persists team to disk on create", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-teams-"));
  try {
    const store = new TeamStore(dir);
    store.create({ name: "persisted", description: "test" });

    const filePath = path.join(dir, "persisted.json");
    assert.ok(fs.existsSync(filePath), "team file should exist on disk");

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
    assert.equal(parsed["name"], "persisted");
    assert.equal(parsed["description"], "test");
    assert.equal(parsed["version"], 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("TeamStore reloads teams from disk on construction", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-teams-reload-"));
  try {
    const store1 = new TeamStore(dir);
    store1.create({ name: "survives", description: "reload test" });

    const store2 = new TeamStore(dir);
    const loaded = store2.get("survives");
    assert.ok(loaded, "team should be reloaded from disk");
    assert.equal(loaded!.name, "survives");
    assert.equal(loaded!.description, "reload test");
    assert.equal(loaded!.version, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("TeamStore persists on update", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-teams-update-"));
  try {
    const store1 = new TeamStore(dir);
    store1.create({ name: "up" });
    store1.update({ name: "up", description: "changed" });

    const store2 = new TeamStore(dir);
    const loaded = store2.get("up");
    assert.ok(loaded);
    assert.equal(loaded!.description, "changed");
    assert.equal(loaded!.version, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("TeamStore deletes file from disk on delete", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-teams-del-"));
  try {
    const store = new TeamStore(dir);
    store.create({ name: "rm" });
    assert.ok(fs.existsSync(path.join(dir, "rm.json")));

    store.delete("rm");
    assert.ok(!fs.existsSync(path.join(dir, "rm.json")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("TeamStore skips corrupt files on load", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-teams-corrupt-"));
  try {
    fs.writeFileSync(path.join(dir, "good.json"), JSON.stringify({ name: "good", members: [], workspaces: [], version: 1, createdAt: "t", updatedAt: "t" }));
    fs.writeFileSync(path.join(dir, "bad.json"), "not json{{{");

    const store = new TeamStore(dir);
    assert.ok(store.get("good"));
    assert.equal(store.get("bad"), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
