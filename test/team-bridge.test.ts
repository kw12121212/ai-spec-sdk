import { test, expect } from "bun:test";
import { BridgeServer } from "../src/bridge.js";

test("team.create creates a team with creator as owner", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2000,
    method: "team.create",
    params: { name: "engineering", description: "Eng team" },
  });

  expect(!response.error).toBeTruthy();
  const result = response.result as Record<string, unknown>;
  expect(result["name"]).toBe("engineering");
  expect(result["description"]).toBe("Eng team");
  expect(result["version"]).toBe(1);

  const members = result["members"] as Array<Record<string, unknown>>;
  expect(members.length).toBe(1);
  expect(members[0]["userId"]).toBe("creator");
  expect(members[0]["role"]).toBe("owner");

  const workspaces = result["workspaces"] as string[];
  expect(workspaces).toEqual([]);
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

  expect(!response.error).toBeTruthy();
  const result = response.result as Record<string, unknown>;
  const members = result["members"] as Array<Record<string, unknown>>;
  expect(members.length).toBe(2);
  expect(members[0]["userId"]).toBe("creator");
  expect(members[1]["userId"]).toBe("alice");
  expect(result["workspaces"]).toEqual(["/proj/a"]);
});

test("team.create rejects missing name", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2002,
    method: "team.create",
    params: { description: "no name" },
  });

  expect(response.error).toBeTruthy();
  expect(response.error!.code).toBe(-32602);
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

  expect(response.error).toBeTruthy();
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

  expect(!response.error).toBeTruthy();
  expect((response.result as Record<string, unknown>)["name"]).toBe("get-me");
});

test("team.get returns -32031 for missing team", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2011,
    method: "team.get",
    params: { name: "missing" },
  });

  expect(response.error).toBeTruthy();
  expect(response.error!.code).toBe(-32031);
});

test("team.get rejects missing name", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2012,
    method: "team.get",
    params: {},
  });

  expect(response.error).toBeTruthy();
  expect(response.error!.code).toBe(-32602);
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

  expect(!response.error).toBeTruthy();
  const result = response.result as Record<string, unknown>;
  expect(result["description"]).toBe("new");
  expect(result["workspaces"]).toEqual(["/x"]);
  expect(result["version"]).toBe(2);
});

test("team.update returns -32031 for missing team", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2021,
    method: "team.update",
    params: { name: "nope", description: "x" },
  });

  expect(response.error).toBeTruthy();
  expect(response.error!.code).toBe(-32031);
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

  expect(!delResponse.error).toBeTruthy();
  expect((delResponse.result as Record<string, unknown>)["removed"]).toBe(true);

  const getResponse = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2031,
    method: "team.get",
    params: { name: "deletable" },
  });

  expect(getResponse.error).toBeTruthy();
  expect(getResponse.error!.code).toBe(-32031);
});

test("team.delete returns -32031 for missing team", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2032,
    method: "team.delete",
    params: { name: "nope" },
  });

  expect(response.error).toBeTruthy();
  expect(response.error!.code).toBe(-32031);
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

  expect(!response.error).toBeTruthy();
  const result = response.result as Record<string, unknown>;
  const teams = result["teams"] as Array<Record<string, unknown>>;
  expect(teams.length >= 2).toBeTruthy();
  expect(teams[0]["name"]).toBe("alpha");
  expect(teams[1]["name"]).toBe("zebra");
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

  expect(!response.error).toBeTruthy();
  const result = response.result as Record<string, unknown>;
  const members = result["members"] as Array<Record<string, unknown>>;
  expect(members.length).toBe(2);
  expect(members[1]["userId"]).toBe("alice");
  expect(members[1]["role"]).toBe("admin");
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

  expect(response.error).toBeTruthy();
  expect(response.error!.code).toBe(-32602);
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

  expect(response.error).toBeTruthy();
  expect(response.error!.code).toBe(-32602);
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

  expect(response.error).toBeTruthy();
  expect(response.error!.code).toBe(-32602);
});

test("team.addMember returns -32031 for missing team", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2054,
    method: "team.addMember",
    params: { name: "nope", userId: "x", role: "member" },
  });

  expect(response.error).toBeTruthy();
  expect(response.error!.code).toBe(-32031);
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

  expect(!response.error).toBeTruthy();
  const members = (response.result as Record<string, unknown>)["members"] as Array<Record<string, unknown>>;
  expect(members.length).toBe(1);
  expect(members[0]["userId"]).toBe("creator");
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

  expect(response.error).toBeTruthy();
  expect(response.error!.code).toBe(-32602);
});

test("team.removeMember rejects missing userId", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2062,
    method: "team.removeMember",
    params: { name: "x" },
  });

  expect(response.error).toBeTruthy();
  expect(response.error!.code).toBe(-32602);
});

test("team methods appear in capabilities", async () => {
  const server = new BridgeServer();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2099,
    method: "bridge.capabilities",
  });

  expect(!response.error).toBeTruthy();
  const result = response.result as Record<string, unknown>;
  const methods = result["methods"] as string[];

  const teamMethods = [
    "team.create", "team.get", "team.update", "team.delete",
    "team.list", "team.addMember", "team.removeMember",
  ];
  for (const m of teamMethods) {
    expect(methods.includes(m), `capabilities should include ${m}`).toBeTruthy();
  }
});
