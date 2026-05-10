import type { Secret } from "./types.js";

export interface SecretStore {
  getSecret(scope: string, key: string): Promise<Secret | null>;
  setSecret(scope: string, secret: Secret): Promise<void>;
  deleteSecret(scope: string, key: string): Promise<boolean>;
  listSecrets(scope: string): Promise<string[]>;
}

export class MemorySecretStore implements SecretStore {
  protected store: Map<string, Secret> = new Map();

  async getSecret(scope: string, key: string): Promise<Secret | null> {
    const secret = this.store.get(key);
    if (!secret) return null;
    
    if (secret.metadata?.scope !== scope) {
      throw new Error(`Access denied: secret '${key}' is not accessible in scope '${scope}'`);
    }
    
    return secret;
  }

  async setSecret(scope: string, secret: Secret): Promise<void> {
    const secretToStore = {
      ...secret,
      metadata: {
        ...secret.metadata,
        scope,
      },
    };
    this.store.set(secret.key, secretToStore);
  }

  async deleteSecret(scope: string, key: string): Promise<boolean> {
    const secret = this.store.get(key);
    if (!secret) return false;

    if (secret.metadata?.scope !== scope) {
      throw new Error(`Access denied: secret '${key}' is not accessible in scope '${scope}'`);
    }

    return this.store.delete(key);
  }

  async listSecrets(scope: string): Promise<string[]> {
    const results: string[] = [];
    for (const secret of this.store.values()) {
      if (secret.metadata?.scope === scope) {
        results.push(secret.key);
      }
    }
    return results;
  }
}
