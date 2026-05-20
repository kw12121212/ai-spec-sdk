import type { ProviderConfig } from "./types.js";

function configString(config: ProviderConfig, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }
  return undefined;
}

function configEnv(config: ProviderConfig): Record<string, string | undefined> {
  if (!config.env || typeof config.env !== "object" || Array.isArray(config.env)) {
    return {};
  }

  const env: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(config.env)) {
    if (typeof value === "string" || value === undefined) {
      env[key] = value;
    }
  }
  return env;
}

export function buildAnthropicSdkEnv(config: ProviderConfig): Record<string, string | undefined> {
  const derived: Record<string, string | undefined> = {};
  const apiKey = configString(config, "apiKey");
  const authToken = configString(config, "authToken");
  const baseUrl = configString(config, "baseUrl", "baseURL", "apiBaseUrl", "apiBaseURL");

  if (apiKey !== undefined) derived["ANTHROPIC_API_KEY"] = apiKey;
  if (authToken !== undefined) derived["ANTHROPIC_AUTH_TOKEN"] = authToken;
  if (baseUrl !== undefined) derived["ANTHROPIC_BASE_URL"] = baseUrl;

  return {
    ...derived,
    ...configEnv(config),
  };
}

export function hasAnthropicCredential(config: ProviderConfig): boolean {
  const env = buildAnthropicSdkEnv(config);
  const apiKey = env["ANTHROPIC_API_KEY"] ?? process.env.ANTHROPIC_API_KEY;
  const authToken = env["ANTHROPIC_AUTH_TOKEN"] ?? process.env.ANTHROPIC_AUTH_TOKEN;
  return Boolean(apiKey?.trim() || authToken?.trim());
}
