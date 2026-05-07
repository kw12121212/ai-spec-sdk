import { expect, test, describe, beforeEach, afterEach, mock } from "bun:test";
import { HashiCorpVaultAdapter } from "../../src/storage/hashicorp-vault-adapter.js";
import { Secret } from "../../src/storage/types.js";

describe("HashiCorpVaultAdapter", () => {
  let adapter: HashiCorpVaultAdapter;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    adapter = new HashiCorpVaultAdapter({
      endpoint: "http://127.0.0.1:8200",
      token: "test-token"
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("getSecret reads secret correctly", async () => {
    globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString();
      expect(url).toBe("http://127.0.0.1:8200/v1/secret/data/test-key");
      expect((init?.headers as Record<string, string>)?.["X-Vault-Token"]).toBe("test-token");
      
      return new Response(JSON.stringify({
        data: {
          data: {
            value: "super-secret",
            metadata: { foo: "bar" },
            createdAt: 1000
          }
        }
      }));
    }) as any;

    const secret = await adapter.getSecret("test-key");
    expect(secret).toEqual({
      key: "test-key",
      value: "super-secret",
      metadata: { foo: "bar" },
      createdAt: 1000
    });
  });

  test("getSecret returns null for 404", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(null, { status: 404 });
    }) as any;

    const secret = await adapter.getSecret("test-key");
    expect(secret).toBeNull();
  });

  test("setSecret writes secret correctly", async () => {
    let requestBody: any;
    globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString();
      expect(url).toBe("http://127.0.0.1:8200/v1/secret/data/test-key");
      expect(init?.method).toBe("POST");
      requestBody = JSON.parse(init?.body as string);
      
      return new Response(null, { status: 200 });
    }) as any;

    await adapter.setSecret({
      key: "test-key",
      value: "new-secret",
      createdAt: 2000
    });

    expect(requestBody).toEqual({
      data: {
        value: "new-secret",
        createdAt: 2000
      }
    });
  });

  test("deleteSecret deletes correctly", async () => {
    globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString();
      expect(url).toBe("http://127.0.0.1:8200/v1/secret/data/test-key");
      expect(init?.method).toBe("DELETE");
      return new Response(null, { status: 200 });
    }) as any;

    const result = await adapter.deleteSecret("test-key");
    expect(result).toBeTrue();
  });

  test("listSecrets lists correctly", async () => {
    globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString();
      expect(url).toBe("http://127.0.0.1:8200/v1/secret/metadata?list=true");
      expect(init?.method).toBe("GET");
      
      return new Response(JSON.stringify({
        data: {
          keys: ["key1", "key2"]
        }
      }));
    }) as any;

    const keys = await adapter.listSecrets();
    expect(keys).toEqual(["key1", "key2"]);
  });
});