import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { VersionedFileSecretVault } from "../../src/storage/secret-versioning.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("VersionedFileSecretVault", () => {
  let vaultDir: string;
  let vault: VersionedFileSecretVault;

  beforeAll(async () => {
    process.env.AI_SPEC_MASTER_KEY = "test-master-key-which-must-be-long-enough";
    vaultDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-spec-secret-vault-test-"));
    vault = new VersionedFileSecretVault(vaultDir);
  });

  afterAll(async () => {
    await fs.rm(vaultDir, { recursive: true, force: true });
    delete process.env.AI_SPEC_MASTER_KEY;
  });

  test("should store and retrieve initial secret version", async () => {
    await vault.setSecret({
      key: "test-secret-1",
      value: "value-1",
      createdAt: Date.now()
    });

    const active = await vault.getSecret("test-secret-1");
    expect(active).not.toBeNull();
    expect(active?.value).toBe("value-1");

    const history = await vault.getSecretHistory("test-secret-1");
    expect(history).not.toBeNull();
    expect(history?.length).toBe(1);
    expect(history?.[0].version).toBe(1);
    expect(history?.[0].value).toBe("value-1");
  });

  test("should store multiple versions and retrieve active by default", async () => {
    await vault.setSecret({
      key: "test-secret-2",
      value: "version-1",
      createdAt: Date.now()
    });

    await vault.setSecret({
      key: "test-secret-2",
      value: "version-2",
      createdAt: Date.now()
    });

    const active = await vault.getSecret("test-secret-2");
    expect(active?.value).toBe("version-2");

    const history = await vault.getSecretHistory("test-secret-2");
    expect(history?.length).toBe(2);
    expect(history?.[0].version).toBe(1);
    expect(history?.[1].version).toBe(2);
    
    const v1 = await vault.getSecretVersion("test-secret-2", 1);
    expect(v1?.value).toBe("version-1");
  });

  test("should rollback to a previous version", async () => {
    await vault.setSecret({
      key: "test-secret-3",
      value: "v1",
      createdAt: Date.now()
    });
    await vault.setSecret({
      key: "test-secret-3",
      value: "v2",
      createdAt: Date.now()
    });

    // Currently active is v2
    let active = await vault.getSecret("test-secret-3");
    expect(active?.value).toBe("v2");

    // Rollback to v1
    const success = await vault.rollbackSecret("test-secret-3", 1);
    expect(success).toBe(true);

    active = await vault.getSecret("test-secret-3");
    expect(active?.value).toBe("v1");

    // History still contains both
    const history = await vault.getSecretHistory("test-secret-3");
    expect(history?.length).toBe(2);
  });

  test("should prune old versions while keeping the active one", async () => {
    // create 4 versions
    for (let i = 1; i <= 4; i++) {
        await vault.setSecret({
            key: "test-secret-4",
            value: `v${i}`,
            createdAt: Date.now()
        });
    }

    // rollback to v2
    await vault.rollbackSecret("test-secret-4", 2);

    // prune to keep only 2 versions
    // it should keep the most recent ones (v4), but also MUST keep active (v2)
    const success = await vault.pruneSecretVersions("test-secret-4", 2);
    expect(success).toBe(true);

    const history = await vault.getSecretHistory("test-secret-4");
    expect(history?.length).toBe(2);
    // expect to keep v4 and v2
    const versions = history?.map(v => v.version) || [];
    expect(versions).toContain(2); // active
    expect(versions).toContain(4); // most recent
    
    // v3 and v1 should be pruned
    expect(versions).not.toContain(1);
    expect(versions).not.toContain(3);
  });

  test("should return multiple valid secrets during grace period", async () => {
    const key = "test-secret-grace";
    
    // v1 created in the past
    await vault.setSecret({
      key,
      value: "v1",
      createdAt: Date.now() - 10000,
      metadata: { rotationIntervalMs: "3600000", gracePeriodMs: "5000" }
    });

    // v2 created now (rotation)
    await vault.setSecret({
      key,
      value: "v2",
      createdAt: Date.now(),
      metadata: { rotationIntervalMs: "3600000", gracePeriodMs: "5000" }
    });

    const valid = await vault.getValidSecrets(key);
    expect(valid).not.toBeNull();
    expect(valid?.length).toBe(2);
    const values = valid?.map(s => s.value);
    expect(values).toContain("v1");
    expect(values).toContain("v2");
  });

  test("should return only active secret if grace period expired", async () => {
    const key = "test-secret-grace-expired";
    
    await vault.setSecret({
      key,
      value: "v1",
      createdAt: Date.now() - 20000,
      metadata: { rotationIntervalMs: "3600000", gracePeriodMs: "5000" }
    });

    // v2 created 6 seconds ago (grace period is 5 seconds)
    await vault.setSecret({
      key,
      value: "v2",
      createdAt: Date.now() - 6000,
      metadata: { rotationIntervalMs: "3600000", gracePeriodMs: "5000" }
    });

    const valid = await vault.getValidSecrets(key);
    expect(valid).not.toBeNull();
    expect(valid?.length).toBe(1);
    expect(valid?.[0].value).toBe("v2");
  });
});
