import { AuditLog } from "../audit-log.js";
import type { Secret, SecretVault, VaultAuditPayload } from "./types.js";

export class AuditedSecretVault implements SecretVault {
  constructor(
    private vault: SecretVault,
    private auditLog: AuditLog,
    private callerContext: { sessionId?: string; teamId?: string; [key: string]: unknown } = {}
  ) {}

  private logEvent(operation: VaultAuditPayload["operation"], secretId: string) {
    const payload: VaultAuditPayload = {
      secretId,
      operation,
      callerContext: this.callerContext,
    };
    
    const entry = this.auditLog.createEntry(
      this.callerContext.sessionId || "system",
      "secret.access",
      "security",
      payload as unknown as Record<string, unknown>
    );
    this.auditLog.write(entry);
  }

  async getSecret(key: string): Promise<Secret | null> {
    this.logEvent("read", key);
    return this.vault.getSecret(key);
  }

  async setSecret(secret: Secret): Promise<void> {
    this.logEvent("write", secret.key);
    return this.vault.setSecret(secret);
  }

  async deleteSecret(key: string): Promise<boolean> {
    this.logEvent("delete", key);
    return this.vault.deleteSecret(key);
  }

  async listSecrets(): Promise<string[]> {
    this.logEvent("list", "*");
    return this.vault.listSecrets();
  }
}
