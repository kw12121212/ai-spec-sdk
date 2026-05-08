import crypto from "node:crypto";
import { FileStorageAdapter } from "./file-adapter.js";
import type { Secret, SecretVersion, VersionedSecret, VersionedSecretVault } from "./types.js";

interface EncryptedPayload {
  iv: string;
  ciphertext: string;
  authTag: string;
}

export class VersionedFileSecretVault implements VersionedSecretVault {
  private adapter: FileStorageAdapter<EncryptedPayload>;
  private key: Buffer;

  constructor(baseDir: string) {
    this.adapter = new FileStorageAdapter<EncryptedPayload>(baseDir);
    const masterKey = process.env.AI_SPEC_MASTER_KEY;
    if (!masterKey) {
      throw new Error("AI_SPEC_MASTER_KEY environment variable is required");
    }
    // Ensure we have exactly 32 bytes for AES-256
    this.key = crypto.createHash("sha256").update(masterKey).digest();
  }

  private async getVersionedSecret(key: string): Promise<VersionedSecret | null> {
    const payload = await this.adapter.get(key);
    if (!payload) {
      return null;
    }

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(payload.iv, "hex")
    );
    decipher.setAuthTag(Buffer.from(payload.authTag, "hex"));

    let decrypted = decipher.update(payload.ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");

    const parsed = JSON.parse(decrypted);
    
    if (Array.isArray(parsed.versions)) {
        return parsed as VersionedSecret;
    } else {
        const legacySecret = parsed as Secret;
        return {
            key: legacySecret.key,
            activeVersion: 1,
            versions: [
                {
                    version: 1,
                    value: legacySecret.value,
                    metadata: legacySecret.metadata,
                    createdAt: legacySecret.createdAt
                }
            ]
        };
    }
  }

  private async saveVersionedSecret(vs: VersionedSecret): Promise<void> {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.key, iv);

    const data = JSON.stringify(vs);
    let ciphertext = cipher.update(data, "utf8", "hex");
    ciphertext += cipher.final("hex");

    const payload: EncryptedPayload = {
      iv: iv.toString("hex"),
      ciphertext,
      authTag: cipher.getAuthTag().toString("hex"),
    };

    await this.adapter.set(vs.key, payload);
  }

  async getSecret(key: string): Promise<Secret | null> {
    const vs = await this.getVersionedSecret(key);
    if (!vs) return null;

    const active = vs.versions.find(v => v.version === vs.activeVersion);
    if (!active) return null;

    return {
        key: vs.key,
        value: active.value,
        metadata: active.metadata,
        createdAt: active.createdAt
    };
  }

  async getSecretVersion(key: string, version: number): Promise<Secret | null> {
    const vs = await this.getVersionedSecret(key);
    if (!vs) return null;

    const target = vs.versions.find(v => v.version === version);
    if (!target) return null;

    return {
        key: vs.key,
        value: target.value,
        metadata: target.metadata,
        createdAt: target.createdAt
    };
  }

  async setSecret(secret: Secret): Promise<void> {
    let vs = await this.getVersionedSecret(secret.key);
    
    if (!vs) {
        vs = {
            key: secret.key,
            activeVersion: 1,
            versions: []
        };
    }

    const maxVersion = vs.versions.length > 0 ? Math.max(...vs.versions.map(v => v.version)) : 0;
    const newVersionNum = maxVersion + 1;

    const newVersion: SecretVersion = {
        version: newVersionNum,
        value: secret.value,
        metadata: secret.metadata,
        createdAt: secret.createdAt || Date.now()
    };

    vs.versions.push(newVersion);
    vs.activeVersion = newVersionNum;

    await this.saveVersionedSecret(vs);
  }

  async rollbackSecret(key: string, version: number): Promise<boolean> {
    const vs = await this.getVersionedSecret(key);
    if (!vs) return false;

    const target = vs.versions.find(v => v.version === version);
    if (!target) return false;

    vs.activeVersion = version;
    await this.saveVersionedSecret(vs);
    return true;
  }

  async getSecretHistory(key: string): Promise<SecretVersion[] | null> {
    const vs = await this.getVersionedSecret(key);
    if (!vs) return null;
    return vs.versions;
  }

  async pruneSecretVersions(key: string, keepVersions: number): Promise<boolean> {
    const vs = await this.getVersionedSecret(key);
    if (!vs) return false;

    if (vs.versions.length <= keepVersions) {
      return true; // Nothing to prune
    }

    // Sort versions descending to keep the most recent ones
    const sorted = [...vs.versions].sort((a, b) => b.version - a.version);
    
    // Make sure we always keep the active version, regardless of the limit
    const activeVersionData = vs.versions.find(v => v.version === vs.activeVersion);
    
    // Take the top 'keepVersions'
    let toKeep = sorted.slice(0, keepVersions);
    
    // If active version is not in the kept list, we need to ensure it's retained.
    // Replace the oldest kept version with the active version.
    if (activeVersionData && !toKeep.find(v => v.version === vs.activeVersion)) {
        toKeep[toKeep.length - 1] = activeVersionData;
    }

    vs.versions = toKeep;
    await this.saveVersionedSecret(vs);
    return true;
  }

  async deleteSecret(key: string): Promise<boolean> {
    return this.adapter.delete(key);
  }

  async listSecrets(): Promise<string[]> {
    return this.adapter.list();
  }
}
