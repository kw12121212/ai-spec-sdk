import { test, expect } from "bun:test";
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
    expect(store.hasRole("developer")).toBe(true);
    expect(store.hasRole("operator")).toBe(true);
    expect(store.hasRole("unknown")).toBe(false);

    const resolved = store.resolveRoles(["developer", "operator"]);
    expect(resolved.includes("file:read")).toBeTruthy();
    expect(resolved.includes("file:write")).toBeTruthy();
    expect(resolved.includes("session:read")).toBeTruthy();
    expect(resolved.includes("session:write")).toBeTruthy();
    expect(resolved.length).toBe(4);
  } finally {
    cleanup();
  }
});

test("RoleStore handles missing roles.yaml", () => {
  const { rolesFile, cleanup } = tempRolesFile();
  try {
    const store = new RoleStore({ rolesFile });
    expect(store.getRolesMap().size).toBe(0);
  } finally {
    cleanup();
  }
});

test("RoleStore handles malformed roles.yaml", () => {
  const { rolesFile, cleanup } = tempRolesFile();
  try {
    fs.writeFileSync(rolesFile, "this is not valid yaml for roles\\n  - some list", "utf8");
    const store = new RoleStore({ rolesFile });
    expect(store.getRolesMap().size).toBe(0);
  } finally {
    cleanup();
  }
});
