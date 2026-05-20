import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface E2EConfig {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export function loadE2EConfig(): E2EConfig {
  // Check for the local-only, gitignored e2e-config.json in the project root.
  const configPath = join(process.cwd(), 'e2e-config.json');
  
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf8');
      return JSON.parse(content) as E2EConfig;
    } catch (err) {
      console.warn(`Failed to parse ${configPath}:`, err);
    }
  }

  // Fallback to environment variables
  if (process.env.E2E_PROVIDER && process.env.E2E_API_KEY) {
    return {
      provider: process.env.E2E_PROVIDER,
      apiKey: process.env.E2E_API_KEY,
      baseUrl: process.env.E2E_BASE_URL,
      model: process.env.E2E_MODEL,
    };
  }

  throw new Error(
    'E2E tests require local-only configuration. Please create the gitignored e2e-config.json file or set E2E_PROVIDER and E2E_API_KEY env vars. ' +
    'Example e2e-config.json: { "provider": "openai", "apiKey": "sk-...", "model": "gpt-4o" }'
  );
}
