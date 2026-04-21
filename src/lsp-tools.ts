import { HoverRequest, DefinitionRequest, ReferencesRequest } from 'vscode-languageserver-protocol/node.js';
import type { LspClient } from './lsp-client.js';
import { toolRegistry } from './unified-tool-registry.js';

export interface LspToolInput {
  uri: string;
  line: number;
  character: number;
}

export function createLspTools(client: LspClient) {
  const tools = [
    {
      name: 'hover',
      description: 'Get hover information for a specific position in a file. Use this to understand symbol types and documentation.',
      inputSchema: {
        type: 'object',
        properties: {
          uri: { type: 'string', description: 'The document URI (e.g., file:///path/to/file.ts).' },
          line: { type: 'number', description: 'The zero-based line number.' },
          character: { type: 'number', description: 'The zero-based character offset.' }
        },
        required: ['uri', 'line', 'character']
      },
      call: async (input: LspToolInput) => {
        try {
          const { uri, line, character } = input;
          const result = await client.getConnection().sendRequest(HoverRequest.type, {
            textDocument: { uri },
            position: { line, character }
          });
          return result ? JSON.stringify(result, null, 2) : "No hover information found.";
        } catch (e: any) {
          return `LSP error: ${e.message}`;
        }
      }
    },
    {
      name: 'definition',
      description: 'Locate the definition of a symbol at a specific position in a file.',
      inputSchema: {
        type: 'object',
        properties: {
          uri: { type: 'string', description: 'The document URI (e.g., file:///path/to/file.ts).' },
          line: { type: 'number', description: 'The zero-based line number.' },
          character: { type: 'number', description: 'The zero-based character offset.' }
        },
        required: ['uri', 'line', 'character']
      },
      call: async (input: LspToolInput) => {
        try {
          const { uri, line, character } = input;
          const result = await client.getConnection().sendRequest(DefinitionRequest.type, {
            textDocument: { uri },
            position: { line, character }
          });
          return result ? JSON.stringify(result, null, 2) : "No definition found.";
        } catch (e: any) {
          return `LSP error: ${e.message}`;
        }
      }
    },
    {
      name: 'references',
      description: 'Find all references to a symbol at a specific position in a file.',
      inputSchema: {
        type: 'object',
        properties: {
          uri: { type: 'string', description: 'The document URI (e.g., file:///path/to/file.ts).' },
          line: { type: 'number', description: 'The zero-based line number.' },
          character: { type: 'number', description: 'The zero-based character offset.' }
        },
        required: ['uri', 'line', 'character']
      },
      call: async (input: LspToolInput) => {
        try {
          const { uri, line, character } = input;
          const result = await client.getConnection().sendRequest(ReferencesRequest.type, {
            textDocument: { uri },
            position: { line, character },
            context: { includeDeclaration: true }
          });
          return result ? JSON.stringify(result, null, 2) : "No references found.";
        } catch (e: any) {
          return `LSP error: ${e.message}`;
        }
      }
    }
  ];

  return tools.map(t => toolRegistry.register('lsp', t));
}
