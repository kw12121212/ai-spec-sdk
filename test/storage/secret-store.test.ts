import { describe, expect, it, beforeEach } from "bun:test";
import { MemorySecretStore } from "../../src/storage/secret-store.js";
import type { Secret } from "../../src/storage/types.js";

describe("MemorySecretStore", () => {
  let store: MemorySecretStore;

  beforeEach(() => {
    store = new MemorySecretStore();
  });

  const createSecret = (key: string, value: string): Secret => ({
    key,
    value,
    createdAt: Date.now(),
  });

  it("should store and retrieve a secret within the same scope", async () => {
    const secret = createSecret("api-key", "secret-value");
    await store.setSecret("team-a", secret);

    const retrieved = await store.getSecret("team-a", "api-key");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.value).toBe("secret-value");
  });

  it("should deny access when accessing a secret with a different scope", async () => {
    const secret = createSecret("api-key", "secret-value");
    await store.setSecret("team-a", secret);

    expect(store.getSecret("team-b", "api-key")).rejects.toThrow(
      "Access denied: secret 'api-key' is not accessible in scope 'team-b'"
    );
  });

  it("should deny deletion when deleting a secret with a different scope", async () => {
    const secret = createSecret("api-key", "secret-value");
    await store.setSecret("team-a", secret);

    expect(store.deleteSecret("team-b", "api-key")).rejects.toThrow(
      "Access denied: secret 'api-key' is not accessible in scope 'team-b'"
    );

    // Verify it still exists in the correct scope
    const retrieved = await store.getSecret("team-a", "api-key");
    expect(retrieved).not.toBeNull();
  });

  it("should list only secrets belonging to the provided scope", async () => {
    await store.setSecret("team-a", createSecret("key-1", "val1"));
    await store.setSecret("team-a", createSecret("key-2", "val2"));
    await store.setSecret("team-b", createSecret("key-3", "val3"));

    const teamAKeys = await store.listSecrets("team-a");
    expect(teamAKeys).toHaveLength(2);
    expect(teamAKeys).toContain("key-1");
    expect(teamAKeys).toContain("key-2");

    const teamBKeys = await store.listSecrets("team-b");
    expect(teamBKeys).toHaveLength(1);
    expect(teamBKeys).toContain("key-3");
  });

  it("should return null when retrieving a non-existent secret", async () => {
    const retrieved = await store.getSecret("team-a", "non-existent");
    expect(retrieved).toBeNull();
  });

  it("should return false when deleting a non-existent secret", async () => {
    const deleted = await store.deleteSecret("team-a", "non-existent");
    expect(deleted).toBe(false);
  });
});
