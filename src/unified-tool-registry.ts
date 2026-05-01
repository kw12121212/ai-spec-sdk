export interface UnifiedTool {
  name: string;
  description?: string;
  inputSchema: any;
  call: (input: any) => Promise<any>;
  deterministic?: boolean;
}

function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map((item) => stableStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(obj).sort();
  const sortedObj: Record<string, any> = {};
  for (const key of keys) {
    sortedObj[key] = stableStringify(obj[key]);
  }
  return `{${keys.map((key) => `"${key}":${sortedObj[key]}`).join(',')}}`;
}

export class UnifiedToolRegistry {
  private tools: Map<string, UnifiedTool> = new Map();
  private cache: Map<string, any> = new Map();

  /**
   * Clears the tool execution cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Registers a tool with an automatic prefix based on the provider ID
   * to avoid name collisions.
   *
   * @param providerId The ID of the provider (e.g., 'mcp_my_server', 'lsp', 'custom')
   * @param tool The tool to register
   * @returns The registered tool with its prefixed name
   */
  register(providerId: string, tool: Omit<UnifiedTool, 'name'> & { name: string }): UnifiedTool {
    const prefixedName = `${providerId}_${tool.name}`;
    const unifiedTool: UnifiedTool = {
      ...tool,
      name: prefixedName,
    };
    this.tools.set(prefixedName, unifiedTool);
    return unifiedTool;
  }

  /**
   * Removes all tools associated with a specific provider ID.
   */
  removeProvider(providerId: string): void {
    const prefix = `${providerId}_`;
    for (const key of this.tools.keys()) {
      if (key.startsWith(prefix)) {
        this.tools.delete(key);
      }
    }
  }

  /**
   * Unregisters a specific tool by its exact prefixed name.
   */
  unregister(prefixedName: string): boolean {
    return this.tools.delete(prefixedName);
  }

  /**
   * Retrieves a tool by its exact prefixed name.
   */
  get(prefixedName: string): UnifiedTool | undefined {
    return this.tools.get(prefixedName);
  }

  /**
   * Lists all registered tools.
   */
  list(): UnifiedTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Executes a tool by its exact prefixed name.
   */
  async execute(prefixedName: string, input: any): Promise<any> {
    const tool = this.tools.get(prefixedName);
    if (!tool) {
      throw new Error(`Tool not found: ${prefixedName}`);
    }

    if (tool.deterministic) {
      const cacheKey = `tool:${prefixedName}:${stableStringify(input)}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }
      const result = await tool.call(input);
      this.cache.set(cacheKey, result);
      return result;
    }

    return tool.call(input);
  }
}

// Global singleton instance for the unified tool registry
export const toolRegistry = new UnifiedToolRegistry();
