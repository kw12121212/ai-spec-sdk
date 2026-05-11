import { test, expect, mock } from "bun:test";
import { AuditedSecretVault } from "../../src/storage/audited-vault.js";
import { AuditLog } from "../../src/audit-log.js";
import { MemorySecretStore } from "../../src/storage/secret-store.js";
import type { SecretVault, Secret } from "../../src/storage/types.js";

// Mock underlying vault
class MockVault implements SecretVault {
  async getSecret(key: string) { return null; }
  async setSecret(secret: Secret) {}
  async deleteSecret(key: string) { return true; }
  async listSecrets() { return []; }
}

test("AuditedSecretVault logs getSecret without secret value", async () => {
  const auditLog = new AuditLog("/tmp/test-audit");
  const writeMock = mock((entry) => {});
  auditLog.write = writeMock;
  
  const mockVault = new MockVault();
  const auditedVault = new AuditedSecretVault(mockVault, auditLog, { sessionId: "sess-123", teamId: "team-456" });

  await auditedVault.getSecret("my-secret");

  expect(writeMock).toHaveBeenCalled();
  const entry = writeMock.mock.calls[0][0];
  
  expect(entry.eventType).toBe("secret.access");
  expect(entry.category).toBe("security");
  expect(entry.payload.operation).toBe("read");
  expect(entry.payload.secretId).toBe("my-secret");
  expect(entry.payload.callerContext.sessionId).toBe("sess-123");
  expect(entry.payload.callerContext.teamId).toBe("team-456");
  expect(entry.payload.value).toBeUndefined();
  expect(entry.payload.secret).toBeUndefined();
});

test("AuditedSecretVault logs setSecret without secret value", async () => {
  const auditLog = new AuditLog("/tmp/test-audit");
  const writeMock = mock((entry) => {});
  auditLog.write = writeMock;
  
  const mockVault = new MockVault();
  const auditedVault = new AuditedSecretVault(mockVault, auditLog, { sessionId: "sess-123" });

  await auditedVault.setSecret({ key: "my-secret", value: "super-secret-123", createdAt: Date.now() });

  expect(writeMock).toHaveBeenCalled();
  const entry = writeMock.mock.calls[0][0];
  
  expect(entry.payload.operation).toBe("write");
  expect(entry.payload.secretId).toBe("my-secret");
  // Ensure the value is not leaked
  const payloadStr = JSON.stringify(entry.payload);
  expect(payloadStr).not.toContain("super-secret-123");
});

test("AuditedSecretVault logs deleteSecret without secret value", async () => {
  const auditLog = new AuditLog("/tmp/test-audit");
  const writeMock = mock((entry) => {});
  auditLog.write = writeMock;
  
  const mockVault = new MockVault();
  const auditedVault = new AuditedSecretVault(mockVault, auditLog, { sessionId: "sess-123" });

  await auditedVault.deleteSecret("my-secret");

  expect(writeMock).toHaveBeenCalled();
  const entry = writeMock.mock.calls[0][0];
  
  expect(entry.payload.operation).toBe("delete");
  expect(entry.payload.secretId).toBe("my-secret");
});

test("AuditedSecretVault logs listSecrets", async () => {
  const auditLog = new AuditLog("/tmp/test-audit");
  const writeMock = mock((entry) => {});
  auditLog.write = writeMock;
  
  const mockVault = new MockVault();
  const auditedVault = new AuditedSecretVault(mockVault, auditLog, { sessionId: "sess-123" });

  await auditedVault.listSecrets();

  expect(writeMock).toHaveBeenCalled();
  const entry = writeMock.mock.calls[0][0];
  
  expect(entry.payload.operation).toBe("list");
  expect(entry.payload.secretId).toBe("*");
});
