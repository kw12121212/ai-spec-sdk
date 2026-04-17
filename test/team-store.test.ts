import { test, expect } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { TeamStore } from "../src/team-store.js";

test("TeamStore create returns team with creator as owner", () => {
  const store = new TeamStore();
  const team = store.create({ name: "engineering" });

  expect(team.name).toBe("engineering");
  expect(team.version).toBe(1);
  expect(team.members.length).toBe(1);
  expect(team.members[0].userId).toBe("creator");
  expect(team.members[0].role).toBe("owner");
  expect(team.workspaces.length).toBe(0);
  expect(typeof team.createdAt === "string").toBeTruthy();
  expect(typeof team.updatedAt === "string").toBeTruthy();
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

  expect(team.members.length).toBe(3);
  expect(team.members[0].userId).toBe("creator");
  expect(team.members[0].role).toBe("owner");
  expect(team.members[1].userId).toBe("alice");
  expect(team.members[1].role).toBe("admin");
  expect(team.members[2].userId).toBe("bob");
  expect(team.members[2].role).toBe("member");
  expect(team.workspaces).toEqual(["/projects/platform", "/projects/infra"]);
  expect(team.description).toBe("Platform team");
});

test("TeamStore create rejects duplicate name", () => {
  const store = new TeamStore();
  store.create({ name: "eng" });
  expect(() => store.create({ name: "eng" })).toThrow(/already exists/);
});

test("TeamStore get returns team or null", () => {
  const store = new TeamStore();
  store.create({ name: "found" });
  expect(store.get("found")!.name).toBe("found");
  expect(store.get("missing")).toBe(null);
});

test("TeamStore update changes description and workspaces", () => {
  const store = new TeamStore();
  store.create({ name: "dev", description: "old" });

  const updated = store.update({ name: "dev", description: "new", workspaces: ["/a"] });
  expect(updated.description).toBe("new");
  expect(updated.workspaces).toEqual(["/a"]);
  expect(updated.version).toBe(2);
});

test("TeamStore update preserves fields not provided", () => {
  const store = new TeamStore();
  store.create({ name: "keep", description: "original", workspaces: ["/x"] });

  const updated = store.update({ name: "keep", description: "changed" });
  expect(updated.description).toBe("changed");
  expect(updated.workspaces).toEqual(["/x"]);
});

test("TeamStore update rejects non-existent team", () => {
  const store = new TeamStore();
  expect(() => store.update({ name: "nope" })).toThrow(/not found/);
});

test("TeamStore list returns teams sorted by name", () => {
  const store = new TeamStore();
  store.create({ name: "zebra" });
  store.create({ name: "alpha" });
  store.create({ name: "mid" });

  const list = store.list();
  expect(list.length).toBe(3);
  expect(list[0].name).toBe("alpha");
  expect(list[1].name).toBe("mid");
  expect(list[2].name).toBe("zebra");
});

test("TeamStore delete removes team", () => {
  const store = new TeamStore();
  store.create({ name: "gone" });
  expect(store.delete("gone")).toBe(true);
  expect(store.get("gone")).toBe(null);
  expect(store.delete("gone")).toBe(false);
});

test("TeamStore addMember adds a new member", () => {
  const store = new TeamStore();
  store.create({ name: "team" });

  const team = store.addMember("team", "charlie", "member");
  expect(team.members.length).toBe(2);
  expect(team.members[1].userId).toBe("charlie");
  expect(team.members[1].role).toBe("member");
});

test("TeamStore addMember rejects duplicate member", () => {
  const store = new TeamStore();
  store.create({ name: "team" });
  store.addMember("team", "alice", "admin");
  expect(() => store.addMember("team", "alice", "member")).toThrow(/already exists/);
});

test("TeamStore addMember rejects invalid role", () => {
  const store = new TeamStore();
  store.create({ name: "team" });
  expect(() => store.addMember("team", "x", "superuser" as any)).toThrow(/Invalid role/);
});

test("TeamStore addMember rejects non-existent team", () => {
  const store = new TeamStore();
  expect(() => store.addMember("nope", "x", "member")).toThrow(/not found/);
});

test("TeamStore removeMember removes a member", () => {
  const store = new TeamStore();
  store.create({ name: "team" });
  store.addMember("team", "bob", "member");

  const team = store.removeMember("team", "bob");
  expect(team.members.length).toBe(1);
  expect(team.members[0].userId).toBe("creator");
});

test("TeamStore removeMember rejects non-existent member", () => {
  const store = new TeamStore();
  store.create({ name: "team" });
  expect(() => store.removeMember("team", "nobody")).toThrow(/not found/);
});

test("TeamStore removeMember rejects non-existent team", () => {
  const store = new TeamStore();
  expect(() => store.removeMember("nope", "x")).toThrow(/not found/);
});

test("TeamStore persists team to disk on create", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-teams-"));
  try {
    const store = new TeamStore(dir);
    store.create({ name: "persisted", description: "test" });

    const filePath = path.join(dir, "persisted.json");
    expect(fs.existsSync(filePath)).toBeTruthy();

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
    expect(parsed["name"]).toBe("persisted");
    expect(parsed["description"]).toBe("test");
    expect(parsed["version"]).toBe(1);
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
    expect(loaded).toBeTruthy();
    expect(loaded!.name).toBe("survives");
    expect(loaded!.description).toBe("reload test");
    expect(loaded!.version).toBe(1);
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
    expect(loaded).toBeTruthy();
    expect(loaded!.description).toBe("changed");
    expect(loaded!.version).toBe(2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("TeamStore deletes file from disk on delete", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-sdk-teams-del-"));
  try {
    const store = new TeamStore(dir);
    store.create({ name: "rm" });
    expect(fs.existsSync(path.join(dir, "rm.json"))).toBeTruthy();

    store.delete("rm");
    expect(!fs.existsSync(path.join(dir, "rm.json"))).toBeTruthy();
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
    expect(store.get("good")).toBeTruthy();
    expect(store.get("bad")).toBe(null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
