import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { RoleStore, validateRoleStrings } from "../src/role-store.js";

function tempRolesFile(): { rolesFile: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-spec-rs-"));
  const rolesFile = path.join(dir, "roles.yaml");
  return { rolesFile, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test("RoleStore loads valid roles.yaml", () => {
  const { rolesFile, cleanup } = tempRolesFile();
  try {
    fs.writeFileSync(
      rolesFile,
      `
developer:
  - file:read
  - file:write
operator:
  - session:read
  - session:write
      `,
      "utf8",
    );

    const store = new RoleStore({ rolesFile });
    assert.equal(store.hasRole("developer"), true);
    assert.equal(store.hasRole("operator"), true);
    assert.equal(store.hasRole("unknown"), false);

    const resolved = store.resolveRoles(["developer", "operator"]);
    assert.ok(resolved.includes("file:read"));
    assert.ok(resolved.includes("file:write"));
    assert.ok(resolved.includes("session:read"));
    assert.ok(resolved.includes("session:write"));
    assert.equal(resolved.length, 4);
  } finally {
    cleanup();
  }
});

test("RoleStore handles missing roles.yaml", () => {
  const { rolesFile, cleanup } = tempRolesFile();
  try {
    const store = new RoleStore({ rolesFile });
    assert.equal(store.getRolesMap().size, 0);
  } finally {
    cleanup();
  }
});

test("RoleStore handles malformed roles.yaml", () => {
  const { rolesFile, cleanup } = tempRolesFile();
  try {
    fs.writeFileSync(rolesFile, "this is not valid yaml for roles\\n  - some list", "utf8");
    const store = new RoleStore({ rolesFile });
    assert.equal(store.getRolesMap().size, 0);
  } finally {
    cleanup();
  }
});
