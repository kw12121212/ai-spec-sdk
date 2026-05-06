import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { FileSecretVault } from "../../src/storage/secret-vault.js";
import type { Secret } from "../../src/storage/types.js";

describe("FileSecretVault", () => {
  const testDir = path.join(process.cwd(), "test-vault");
  const testKey = "test-master-key-12345678901234567890"; // Some string

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
    process.env.AI_SPEC_MASTER_KEY = testKey;
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    delete process.env.AI_SPEC_MASTER_KEY;
  });

  it("should encrypt and decrypt secrets", async () => {
    const vault = new FileSecretVault(testDir);

    const secret: Secret = {
      key: "test-api-key",
      value: "super-secret-value",
      metadata: { env: "prod" },
      createdAt: Date.now(),
    };

    await vault.setSecret(secret);

    // Verify it is encrypted on disk
    const safeKey = encodeURIComponent(secret.key);
    const filePath = path.join(testDir, `${safeKey}.json`);
    const fileContent = await fs.readFile(filePath, "utf8");
    const payload = JSON.parse(fileContent);

    expect(payload).toHaveProperty("iv");
    expect(payload).toHaveProperty("ciphertext");
    expect(payload).toHaveProperty("authTag");
    expect(payload.ciphertext).not.toContain("super-secret-value");
    expect(payload.ciphertext).not.toContain("test-api-key");

    // Verify it can be decrypted
    const decryptedSecret = await vault.getSecret(secret.key);
    expect(decryptedSecret).toEqual(secret);
  });

  it("should throw if AI_SPEC_MASTER_KEY is missing", () => {
    delete process.env.AI_SPEC_MASTER_KEY;
    expect(() => new FileSecretVault(testDir)).toThrow("AI_SPEC_MASTER_KEY environment variable is required");
  });

  it("should return null for missing secret", async () => {
    const vault = new FileSecretVault(testDir);
    const result = await vault.getSecret("non-existent");
    expect(result).toBeNull();
  });

  it("should delete a secret", async () => {
    const vault = new FileSecretVault(testDir);
    const secret: Secret = {
      key: "to-delete",
      value: "value",
      createdAt: Date.now(),
    };

    await vault.setSecret(secret);
    expect(await vault.getSecret("to-delete")).not.toBeNull();

    const deleted = await vault.deleteSecret("to-delete");
    expect(deleted).toBe(true);
    expect(await vault.getSecret("to-delete")).toBeNull();
  });

  it("should list secrets", async () => {
    const vault = new FileSecretVault(testDir);
    const secret1: Secret = { key: "secret-1", value: "v1", createdAt: Date.now() };
    const secret2: Secret = { key: "secret-2", value: "v2", createdAt: Date.now() };

    await vault.setSecret(secret1);
    await vault.setSecret(secret2);

    const keys = await vault.listSecrets();
    expect(keys).toHaveLength(2);
    expect(keys).toContain("secret-1");
    expect(keys).toContain("secret-2");
  });
});
