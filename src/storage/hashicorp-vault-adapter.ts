import { Secret, VaultAdapter } from './types.js';

export interface HashiCorpVaultConfig {
  endpoint: string; // e.g. "http://127.0.0.1:8200"
  token: string;
  kvPath?: string; // default: "secret/data" for kv-v2
}

export class HashiCorpVaultAdapter implements VaultAdapter {
  private endpoint: string;
  private token: string;
  private kvPath: string;

  constructor(config: HashiCorpVaultConfig) {
    this.endpoint = config.endpoint.replace(/\/$/, '');
    this.token = config.token;
    this.kvPath = config.kvPath || 'secret/data';
  }

  private getUrl(key: string): string {
    return `${this.endpoint}/v1/${this.kvPath}/${encodeURIComponent(key)}`;
  }

  async getSecret(key: string): Promise<Secret | null> {
    const res = await fetch(this.getUrl(key), {
      headers: { 'X-Vault-Token': this.token }
    });
    
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Vault read error: ${res.statusText}`);
    
    const json = await res.json() as any;
    // Handle kv-v2 format response: json.data.data
    const secretData = json.data?.data || json.data || {};
    
    return {
      key,
      value: secretData.value || '',
      metadata: secretData.metadata || undefined,
      createdAt: secretData.createdAt || Date.now()
    };
  }

  async setSecret(secret: Secret): Promise<void> {
    const payload = {
      data: {
        value: secret.value,
        metadata: secret.metadata,
        createdAt: secret.createdAt
      }
    };
    
    const res = await fetch(this.getUrl(secret.key), {
      method: 'POST',
      headers: { 
        'X-Vault-Token': this.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error(`Vault write error: ${res.statusText}`);
  }

  async deleteSecret(key: string): Promise<boolean> {
    // For kv-v2, deleting the latest version is via DELETE /v1/secret/data/:key
    const res = await fetch(this.getUrl(key), {
      method: 'DELETE',
      headers: { 'X-Vault-Token': this.token }
    });
    
    if (res.status === 404) return false;
    if (!res.ok) throw new Error(`Vault delete error: ${res.statusText}`);
    
    return true;
  }

  async listSecrets(): Promise<string[]> {
    // For kv-v2, listing keys usually goes through the metadata path: /v1/secret/metadata/?list=true
    const listPath = this.kvPath.replace(/data(\/|$)/, 'metadata$1');
    const res = await fetch(`${this.endpoint}/v1/${listPath}?list=true`, {
      method: 'GET',
      headers: { 'X-Vault-Token': this.token }
    });
    
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`Vault list error: ${res.statusText}`);
    
    const json = await res.json() as any;
    return json.data?.keys || [];
  }
}
