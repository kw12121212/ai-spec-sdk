import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface ConfigScope {
  scope: "project" | "user";
  workspace?: string;
}

export interface ConfigEntry {
  key: string;
  value: unknown;
  scope: "project" | "user";
}

const KNOWN_KEYS: Record<string, (value: unknown) => string | null> = {
  preferredModel: (v) => typeof v === "string" ? null : "must be a string",
  permissionMode: (v) =>
    typeof v === "string" && ["default", "acceptEdits", "bypassPermissions", "approve"].includes(v)
      ? null
      : "must be one of: default, acceptEdits, bypassPermissions, approve",
  maxTurns: (v) =>
    typeof v === "number" && Number.isInteger(v) && v >= 1
      ? null
      : "must be an integer >= 1",
};

function userSettingsPath(): string {
  return path.join(os.homedir(), ".claude", "settings.json");
}

function projectSettingsPath(workspace: string): string {
  return path.join(workspace, ".claude", "settings.json");
}

function readJson(filePath: string): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function writeJson(filePath: string, data: Record<string, unknown>): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = filePath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmpPath, filePath);
}

export class ConfigStore {
  get(key: string, workspace?: string): ConfigEntry | null {
    // Project scope overrides user scope
    if (workspace) {
      const projectSettings = readJson(projectSettingsPath(workspace));
      if (key in projectSettings) {
        return { key, value: projectSettings[key], scope: "project" };
      }
    }

    const userSettings = readJson(userSettingsPath());
    if (key in userSettings) {
      return { key, value: userSettings[key], scope: "user" };
    }

    return null;
  }

  set(key: string, value: unknown, scope: ConfigScope): ConfigEntry {
    const validator = KNOWN_KEYS[key];
    if (validator) {
      const error = validator(value);
      if (error) {
        throw new Error(`Invalid value for '${key}': ${error}`);
      }
    }

    const filePath = scope.scope === "project" && scope.workspace
      ? projectSettingsPath(scope.workspace)
      : userSettingsPath();

    const settings = readJson(filePath);
    settings[key] = value;
    writeJson(filePath, settings);

    return { key, value, scope: scope.scope };
  }

  list(workspace?: string): ConfigEntry[] {
    const userSettings = readJson(userSettingsPath());
    const projectSettings = workspace ? readJson(projectSettingsPath(workspace)) : {};

    const allKeys = new Set([...Object.keys(userSettings), ...Object.keys(projectSettings)]);

    return Array.from(allKeys).map((key) => {
      const inProject = key in projectSettings;
      return {
        key,
        value: inProject ? projectSettings[key] : userSettings[key],
        scope: inProject ? "project" as const : "user" as const,
        ...(inProject && { projectValue: projectSettings[key] }),
        ...(key in userSettings && { userValue: userSettings[key] }),
      };
    });
  }
}
