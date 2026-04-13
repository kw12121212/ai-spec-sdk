import type { TokenCounter, TokenUsage } from "../types.js";
import { AnthropicTokenCounter, PassthroughTokenCounter } from "./anthropic.js";

interface CounterEntry {
  counter: TokenCounter;
  description: string;
}

class CounterRegistryImpl {
  private counters: Map<string, CounterEntry> = new Map();

  register(counter: TokenCounter, description?: string): void {
    this.counters.set(counter.providerType, { counter, description: description ?? counter.providerType });
  }

  get(providerType: string): TokenCounter {
    const entry = this.counters.get(providerType);
    if (entry) return entry.counter;
    return new PassthroughTokenCounter(providerType);
  }

  list(): Array<{ providerType: string; description: string }> {
    return Array.from(this.counters.entries()).map(([providerType, entry]) => ({
      providerType,
      description: entry.description,
    }));
  }

  countForProvider(providerType: string, usage: unknown): TokenUsage | null {
    const counter = this.get(providerType);
    return counter.count(usage);
  }
}

export const counterRegistry = new CounterRegistryImpl();

counterRegistry.register(new AnthropicTokenCounter(), "Anthropic SDK / Provider format");

export { CounterRegistryImpl, AnthropicTokenCounter, PassthroughTokenCounter };
