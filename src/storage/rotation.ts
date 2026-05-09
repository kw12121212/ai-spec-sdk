import crypto from "node:crypto";
import type { CronScheduler } from "../cron-scheduler.js";
import type { VersionedSecretVault, Secret } from "./types.js";

/**
 * Registers a background job to automatically rotate secrets.
 */
export function registerSecretRotationJob(
  vault: VersionedSecretVault,
  scheduler: CronScheduler,
  generateNewValue: (key: string) => Promise<string> = async () => crypto.randomBytes(32).toString("hex")
) {
  scheduler.registerJob(async () => {
    const keys = await vault.listSecrets();
    for (const key of keys) {
      const secret = await vault.getSecret(key);
      if (!secret || !secret.metadata || !secret.metadata.rotationIntervalMs) {
        continue;
      }

      const intervalMs = parseInt(secret.metadata.rotationIntervalMs, 10);
      if (isNaN(intervalMs)) continue;

      const now = Date.now();
      if (now - secret.createdAt >= intervalMs) {
        const newValue = await generateNewValue(key);
        
        const newSecret: Secret = {
          key: secret.key,
          value: newValue,
          metadata: { ...secret.metadata }, // Preserve existing metadata including gracePeriodMs
          createdAt: now,
        };

        await vault.setSecret(newSecret);
      }
    }
  });
}
