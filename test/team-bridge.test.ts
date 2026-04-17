import test from "node:test";
import assert from "node:assert/strict";
import { BridgeServer } from "../src/bridge.js";

test("team.create creates a team with creator as owner", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2000,
    method: "team.create",
    params: { name: "engineering", description: "Eng team" },
  });

  assert.ok(!response.error, `team.create should not error: ${JSON.stringify(response.error)}`);
  const result = response.result as Record<string, unknown>;
  assert.equal(result["name"], "engineering");
  assert.equal(result["description"], "Eng team");
  assert.equal(result["version"], 1);

  const members = result["members"] as Array<Record<string, unknown>>;
  assert.equal(members.length, 1);
  assert.equal(members[0]["userId"], "creator");
  assert.equal(members[0]["role"], "owner");

  const workspaces = result["workspaces"] as string[];
  assert.deepEqual(workspaces, []);
});

test("team.create with members and workspaces", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2001,
    method: "team.create",
    params: {
      name: "platform",
      members: [{ userId: "alice", role: "admin" }],
      workspaces: ["/proj/a"],
    },
  });

  assert.ok(!response.error);
  const result = response.result as Record<string, unknown>;
  const members = result["members"] as Array<Record<string, unknown>>;
  assert.equal(members.length, 2);
  assert.equal(members[0]["userId"], "creator");
  assert.equal(members[1]["userId"], "alice");
  assert.deepEqual(result["workspaces"], ["/proj/a"]);
});

test("team.create rejects missing name", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2002,
    method: "team.create",
    params: { description: "no name" },
  });

  assert.ok(response.error);
  assert.equal(response.error!.code, -32602);
});

test("team.create rejects duplicate name", async () => {
  const server = new BridgeServer();
  await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "team.create",
    params: { name: "dup" },
  });

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2003,
    method: "team.create",
    params: { name: "dup" },
  });

  assert.ok(response.error);
});

test("team.get returns existing team", async () => {
  const server = new BridgeServer();
  await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "team.create",
    params: { name: "get-me" },
  });

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2010,
    method: "team.get",
    params: { name: "get-me" },
  });

  assert.ok(!response.error);
  assert.equal((response.result as Record<string, unknown>)["name"], "get-me");
});

test("team.get returns -32031 for missing team", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2011,
    method: "team.get",
    params: { name: "missing" },
  });

  assert.ok(response.error);
  assert.equal(response.error!.code, -32031);
});

test("team.get rejects missing name", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2012,
    method: "team.get",
    params: {},
  });

  assert.ok(response.error);
  assert.equal(response.error!.code, -32602);
});

test("team.update updates description and workspaces", async () => {
  const server = new BridgeServer();
  await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "team.create",
    params: { name: "updatable", description: "old" },
  });

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2020,
    method: "team.update",
    params: { name: "updatable", description: "new", workspaces: ["/x"] },
  });

  assert.ok(!response.error);
  const result = response.result as Record<string, unknown>;
  assert.equal(result["description"], "new");
  assert.deepEqual(result["workspaces"], ["/x"]);
  assert.equal(result["version"], 2);
});

test("team.update returns -32031 for missing team", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2021,
    method: "team.update",
    params: { name: "nope", description: "x" },
  });

  assert.ok(response.error);
  assert.equal(response.error!.code, -32031);
});

test("team.delete removes team", async () => {
  const server = new BridgeServer();
  await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "team.create",
    params: { name: "deletable" },
  });

  const delResponse = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2030,
    method: "team.delete",
    params: { name: "deletable" },
  });

  assert.ok(!delResponse.error);
  assert.equal((delResponse.result as Record<string, unknown>)["removed"], true);

  const getResponse = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2031,
    method: "team.get",
    params: { name: "deletable" },
  });

  assert.ok(getResponse.error);
  assert.equal(getResponse.error!.code, -32031);
});

test("team.delete returns -32031 for missing team", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2032,
    method: "team.delete",
    params: { name: "nope" },
  });

  assert.ok(response.error);
  assert.equal(response.error!.code, -32031);
});

test("team.list returns teams sorted by name", async () => {
  const server = new BridgeServer();
  await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "team.create",
    params: { name: "zebra" },
  });
  await server.handleMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "team.create",
    params: { name: "alpha" },
  });

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2040,
    method: "team.list",
  });

  assert.ok(!response.error);
  const result = response.result as Record<string, unknown>;
  const teams = result["teams"] as Array<Record<string, unknown>>;
  assert.ok(teams.length >= 2);
  assert.equal(teams[0]["name"], "alpha");
  assert.equal(teams[1]["name"], "zebra");
});

test("team.addMember adds member to team", async () => {
  const server = new BridgeServer();
  await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "team.create",
    params: { name: "add-members" },
  });

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2050,
    method: "team.addMember",
    params: { name: "add-members", userId: "alice", role: "admin" },
  });

  assert.ok(!response.error);
  const result = response.result as Record<string, unknown>;
  const members = result["members"] as Array<Record<string, unknown>>;
  assert.equal(members.length, 2);
  assert.equal(members[1]["userId"], "alice");
  assert.equal(members[1]["role"], "admin");
});

test("team.addMember rejects duplicate member", async () => {
  const server = new BridgeServer();
  await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "team.create",
    params: { name: "dup-member" },
  });
  await server.handleMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "team.addMember",
    params: { name: "dup-member", userId: "bob", role: "member" },
  });

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2051,
    method: "team.addMember",
    params: { name: "dup-member", userId: "bob", role: "member" },
  });

  assert.ok(response.error);
  assert.equal(response.error!.code, -32602);
});

test("team.addMember rejects invalid role", async () => {
  const server = new BridgeServer();
  await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "team.create",
    params: { name: "bad-role" },
  });

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2052,
    method: "team.addMember",
    params: { name: "bad-role", userId: "x", role: "superuser" },
  });

  assert.ok(response.error);
  assert.equal(response.error!.code, -32602);
});

test("team.addMember rejects missing userId", async () => {
  const server = new BridgeServer();
  await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "team.create",
    params: { name: "no-uid" },
  });

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2053,
    method: "team.addMember",
    params: { name: "no-uid", role: "member" },
  });

  assert.ok(response.error);
  assert.equal(response.error!.code, -32602);
});

test("team.addMember returns -32031 for missing team", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2054,
    method: "team.addMember",
    params: { name: "nope", userId: "x", role: "member" },
  });

  assert.ok(response.error);
  assert.equal(response.error!.code, -32031);
});

test("team.removeMember removes member", async () => {
  const server = new BridgeServer();
  await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "team.create",
    params: { name: "rm-member" },
  });
  await server.handleMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "team.addMember",
    params: { name: "rm-member", userId: "charlie", role: "member" },
  });

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2060,
    method: "team.removeMember",
    params: { name: "rm-member", userId: "charlie" },
  });

  assert.ok(!response.error);
  const members = (response.result as Record<string, unknown>)["members"] as Array<Record<string, unknown>>;
  assert.equal(members.length, 1);
  assert.equal(members[0]["userId"], "creator");
});

test("team.removeMember rejects non-member", async () => {
  const server = new BridgeServer();
  await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "team.create",
    params: { name: "no-such-member" },
  });

  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2061,
    method: "team.removeMember",
    params: { name: "no-such-member", userId: "nobody" },
  });

  assert.ok(response.error);
  assert.equal(response.error!.code, -32602);
});

test("team.removeMember rejects missing userId", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2062,
    method: "team.removeMember",
    params: { name: "x" },
  });

  assert.ok(response.error);
  assert.equal(response.error!.code, -32602);
});

test("team methods appear in capabilities", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2099,
    method: "bridge.capabilities",
  });

  assert.ok(!response.error);
  const result = response.result as Record<string, unknown>;
  const methods = result["methods"] as string[];

  const teamMethods = [
    "team.create", "team.get", "team.update", "team.delete",
    "team.list", "team.addMember", "team.removeMember",
  ];
  for (const m of teamMethods) {
    assert.ok(methods.includes(m), `capabilities should include ${m}`);
  }
});
