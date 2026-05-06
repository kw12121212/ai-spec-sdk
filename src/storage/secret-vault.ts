import crypto from "node:crypto";
import { FileStorageAdapter } from "./file-adapter.js";
import type { Secret, SecretVault } from "./types.js";

interface EncryptedPayload {
  iv: string;
  ciphertext: string;
  authTag: string;
}

export class FileSecretVault implements SecretVault {
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

  async getSecret(key: string): Promise<Secret | null> {
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

    return JSON.parse(decrypted) as Secret;
  }

  async setSecret(secret: Secret): Promise<void> {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.key, iv);

    const data = JSON.stringify(secret);
    let ciphertext = cipher.update(data, "utf8", "hex");
    ciphertext += cipher.final("hex");

    const payload: EncryptedPayload = {
      iv: iv.toString("hex"),
      ciphertext,
      authTag: cipher.getAuthTag().toString("hex"),
    };

    await this.adapter.set(secret.key, payload);
  }

  async deleteSecret(key: string): Promise<boolean> {
    return this.adapter.delete(key);
  }

  async listSecrets(): Promise<string[]> {
    return this.adapter.list();
  }
}
