import { expect, test, describe, beforeAll, afterAll, mock } from "bun:test";
import { registerSecretRotationJob } from "../../src/storage/rotation.js";
import { CronScheduler } from "../../src/cron-scheduler.js";
import { VersionedFileSecretVault } from "../../src/storage/secret-versioning.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// We need mock dependencies for CronScheduler
class MockTaskTemplateStore {
  async getTemplate() { return null; }
  async saveTemplate() {}
  async listTemplates() { return []; }
  async deleteTemplate() { return false; }
}

class MockTaskQueueStore {
  async enqueue() { return "task-id"; }
  async dequeue() { return null; }
  async updateStatus() {}
  async getTask() { return null; }
  async listTasks() { return []; }
}

describe("Secret Rotation Job", () => {
  let vaultDir: string;
  let vault: VersionedFileSecretVault;
  let scheduler: CronScheduler;

  beforeAll(async () => {
    process.env.AI_SPEC_MASTER_KEY = "test-master-key-which-must-be-long-enough";
    vaultDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-spec-secret-vault-rotation-test-"));
    vault = new VersionedFileSecretVault(vaultDir);
    const templateStore = new MockTaskTemplateStore() as any;
    const queueStore = new MockTaskQueueStore() as any;
    scheduler = new CronScheduler(templateStore, queueStore);
  });

  afterAll(async () => {
    await fs.rm(vaultDir, { recursive: true, force: true });
    delete process.env.AI_SPEC_MASTER_KEY;
  });

  test("should rotate eligible secrets when job runs", async () => {
    let newKeyGenCalls = 0;
    const generateNewValue = async () => {
      newKeyGenCalls++;
      return `new-rotated-value-${newKeyGenCalls}`;
    };

    registerSecretRotationJob(vault, scheduler, generateNewValue);

    // Add a secret that requires rotation immediately
    await vault.setSecret({
      key: "test-rotate-1",
      value: "old-value",
      metadata: { rotationIntervalMs: "1000", gracePeriodMs: "5000" },
      createdAt: Date.now() - 2000 // created 2 seconds ago, interval is 1 second
    });

    // Add a secret that does not require rotation yet
    await vault.setSecret({
      key: "test-rotate-2",
      value: "keep-value",
      metadata: { rotationIntervalMs: "5000", gracePeriodMs: "1000" },
      createdAt: Date.now() - 1000 // created 1 second ago, interval is 5 seconds
    });

    // Add a secret with no rotation interval
    await vault.setSecret({
      key: "test-rotate-3",
      value: "permanent-value",
      createdAt: Date.now() - 10000
    });

    // Get the registered job from the scheduler (it's internal, but we know it's a function)
    // The bridge or scheduler runs registered jobs periodically. We will trigger it manually.
    // CronScheduler's start() calls jobs using setInterval. We can hack it by accessing private jobs array or mocking.
    // Actually, CronScheduler keeps an array of callbacks. Let's find it.
    // As a workaround, we can use the scheduler to start and stop, but that's async.
    // We can cast to any and run the jobs.
    const jobs = (scheduler as any).jobs || (scheduler as any).callbacks;
    if (jobs && jobs.length > 0) {
      for (const job of jobs) {
        await job();
      }
    } else {
        // Fallback if we can't find jobs array easily in bun test
        // start and wait a bit
        scheduler.start(50);
        await new Promise(r => setTimeout(r, 100));
        scheduler.stop();
    }

    // Now check if secrets rotated
    const s1 = await vault.getSecret("test-rotate-1");
    expect(s1?.value).toBe("new-rotated-value-1"); // Should have rotated

    const s2 = await vault.getSecret("test-rotate-2");
    expect(s2?.value).toBe("keep-value"); // Should NOT have rotated

    const s3 = await vault.getSecret("test-rotate-3");
    expect(s3?.value).toBe("permanent-value"); // Should NOT have rotated

    // Verify grace period on s1
    const valid = await vault.getValidSecrets("test-rotate-1");
    expect(valid?.length).toBe(2);
    const validValues = valid?.map(s => s.value);
    expect(validValues).toContain("old-value");
    expect(validValues).toContain("new-rotated-value-1");
  });
});
