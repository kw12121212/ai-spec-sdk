import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import yaml from "js-yaml";

export interface RoleStoreOptions {
  rolesFile?: string;
}

export class RoleStore {
  private roles: Map<string, string[]> = new Map();

  constructor(options: RoleStoreOptions = {}) {
    const defaultPath = path.join(os.homedir(), ".ai-spec-sdk", "roles.yaml");
    const rolesFile = options.rolesFile ?? defaultPath;
    this._loadFromDisk(rolesFile);
  }

  private _loadFromDisk(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf8");
        const parsed = yaml.load(content);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          for (const [roleName, scopes] of Object.entries(parsed)) {
            if (Array.isArray(scopes) && scopes.every((s) => typeof s === "string")) {
              this.roles.set(roleName, scopes as string[]);
            }
          }
        }
      }
    } catch {
      // Missing or malformed defaults to empty set of roles
    }
  }

  hasRole(roleName: string): boolean {
    return this.roles.has(roleName);
  }

  resolveRoles(roleNames: string[]): string[] {
    const scopes = new Set<string>();
    for (const roleName of roleNames) {
      const roleScopes = this.roles.get(roleName);
      if (roleScopes) {
        for (const s of roleScopes) {
          scopes.add(s);
        }
      }
    }
    return Array.from(scopes);
  }

  getRolesMap(): Map<string, string[]> {
    return new Map(this.roles);
  }
}

// Singleton instance
export const roleStore = new RoleStore();

export function validateRoleStrings(roles: string[], field: string): void {
  for (const r of roles) {
    if (!roleStore.hasRole(r)) {
      throw new Error(`Invalid ${field} value '${r}'. Unknown role.`);
    }
  }
}
