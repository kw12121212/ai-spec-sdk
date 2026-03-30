import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface StoredKey {
  id: string;
  name: string;
  hash: string; // SHA-256 hex of the raw token — never the raw token itself
  createdAt: string; // ISO timestamp
  expiresAt?: string; // ISO timestamp
  scopes: string[];
}

export const DEFAULT_KEYS_FILE = path.join(os.homedir(), ".ai-spec-sdk", "keys.json");

export function loadKeys(keysFile = DEFAULT_KEYS_FILE): StoredKey[] {
  try {
    const data = fs.readFileSync(keysFile, "utf8");
    return JSON.parse(data) as StoredKey[];
  } catch {
    return [];
  }
}

export function saveKeys(keys: StoredKey[], keysFile = DEFAULT_KEYS_FILE): void {
  fs.mkdirSync(path.dirname(keysFile), { recursive: true });
  fs.writeFileSync(keysFile, JSON.stringify(keys, null, 2), "utf8");
}

export function addKey(key: StoredKey, keysFile = DEFAULT_KEYS_FILE): void {
  const keys = loadKeys(keysFile);
  keys.push(key);
  saveKeys(keys, keysFile);
}

/** Returns true if the key was found and removed; false if no key with that id exists. */
export function revokeKey(id: string, keysFile = DEFAULT_KEYS_FILE): boolean {
  const keys = loadKeys(keysFile);
  const idx = keys.findIndex((k) => k.id === id);
  if (idx === -1) return false;
  keys.splice(idx, 1);
  saveKeys(keys, keysFile);
  return true;
}
