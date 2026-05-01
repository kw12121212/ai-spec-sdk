import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { UnifiedToolRegistry } from '../src/unified-tool-registry.js';

describe('UnifiedToolRegistry', () => {
  let registry: UnifiedToolRegistry;

  beforeEach(() => {
    registry = new UnifiedToolRegistry();
  });

  describe('tool execution cache', () => {
    it('caches the result of a deterministic tool and does not execute the call twice', async () => {
      const callMock = mock(async (input: { a: number }) => input.a * 2);

      registry.register('test', {
        name: 'double',
        inputSchema: {},
        call: callMock,
        deterministic: true,
      });

      const result1 = await registry.execute('test_double', { a: 5 });
      expect(result1).toBe(10);
      expect(callMock).toHaveBeenCalledTimes(1);

      const result2 = await registry.execute('test_double', { a: 5 });
      expect(result2).toBe(10);
      expect(callMock).toHaveBeenCalledTimes(1);
    });

    it('does not cache the result if the tool is not deterministic', async () => {
      const callMock = mock(async (input: { a: number }) => input.a * 2);

      registry.register('test', {
        name: 'double',
        inputSchema: {},
        call: callMock,
        deterministic: false,
      });

      const result1 = await registry.execute('test_double', { a: 5 });
      expect(result1).toBe(10);
      expect(callMock).toHaveBeenCalledTimes(1);

      const result2 = await registry.execute('test_double', { a: 5 });
      expect(result2).toBe(10);
      expect(callMock).toHaveBeenCalledTimes(2);
    });

    it('uses a stable JSON representation for cache keys', async () => {
      const callMock = mock(async (input: any) => 'result');

      registry.register('test', {
        name: 'stable_tool',
        inputSchema: {},
        call: callMock,
        deterministic: true,
      });

      await registry.execute('test_stable_tool', { a: 1, b: 2 });
      expect(callMock).toHaveBeenCalledTimes(1);

      // Call again with keys in different order
      await registry.execute('test_stable_tool', { b: 2, a: 1 });
      expect(callMock).toHaveBeenCalledTimes(1); // Cached result should be used
    });

    it('clears the cache when clearCache is called', async () => {
      const callMock = mock(async (input: { a: number }) => input.a * 2);

      registry.register('test', {
        name: 'double',
        inputSchema: {},
        call: callMock,
        deterministic: true,
      });

      await registry.execute('test_double', { a: 5 });
      expect(callMock).toHaveBeenCalledTimes(1);

      registry.clearCache();

      await registry.execute('test_double', { a: 5 });
      expect(callMock).toHaveBeenCalledTimes(2);
    });
  });
});
