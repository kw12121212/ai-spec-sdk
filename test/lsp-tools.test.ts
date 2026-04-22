import { test, expect, describe, mock } from 'bun:test';
import { createLspTools } from '../src/lsp-tools.js';
import type { LspClient } from '../src/lsp-client.js';
import { HoverRequest, DefinitionRequest, ReferencesRequest } from 'vscode-languageserver-protocol/node.js';

describe('createLspTools', () => {
  const mockSendRequest = mock();
  
  const mockConnection = {
    sendRequest: mockSendRequest
  };

  const mockClient = {
    getConnection: () => mockConnection,
    getDiagnostics: mock()
  } as unknown as LspClient;

  test('lsp_diagnostics returns diagnostics on success', async () => {
    const mockGetDiagnostics = mockClient.getDiagnostics as import('bun:test').Mock<any>;
    mockGetDiagnostics.mockReturnValueOnce([{
      message: 'Syntax error',
      range: { start: { line: 1, character: 1 }, end: { line: 1, character: 10 } },
      severity: 1
    }]);

    const tools = createLspTools(mockClient);
    const diagTool = tools.find(t => t.name === 'lsp_diagnostics');
    expect(diagTool).toBeDefined();

    const result = await diagTool!.call({ uri: 'file:///test.ts' } as any);
    
    expect(mockGetDiagnostics).toHaveBeenCalledWith('file:///test.ts');
    expect(result).toContain('Syntax error');
    expect(result).toContain('"severity": 1');
  });

  test('lsp_hover returns hover info on success', async () => {
    mockSendRequest.mockResolvedValueOnce({
      contents: { kind: 'markdown', value: 'Mock hover' }
    });

    const tools = createLspTools(mockClient);
    const hoverTool = tools.find(t => t.name === 'lsp_hover');
    expect(hoverTool).toBeDefined();

    const result = await hoverTool!.call({ uri: 'file:///test.ts', line: 10, character: 5 });
    
    expect(mockSendRequest).toHaveBeenCalledWith(HoverRequest.type, {
      textDocument: { uri: 'file:///test.ts' },
      position: { line: 10, character: 5 }
    });
    expect(result).toContain('Mock hover');
  });

  test('lsp_definition returns definition info on success', async () => {
    mockSendRequest.mockResolvedValueOnce([{
      uri: 'file:///def.ts',
      range: { start: { line: 1, character: 1 }, end: { line: 1, character: 10 } }
    }]);

    const tools = createLspTools(mockClient);
    const defTool = tools.find(t => t.name === 'lsp_definition');
    expect(defTool).toBeDefined();

    const result = await defTool!.call({ uri: 'file:///test.ts', line: 10, character: 5 });
    
    expect(mockSendRequest).toHaveBeenCalledWith(DefinitionRequest.type, {
      textDocument: { uri: 'file:///test.ts' },
      position: { line: 10, character: 5 }
    });
    expect(result).toContain('file:///def.ts');
  });

  test('lsp_references returns reference info on success', async () => {
    mockSendRequest.mockResolvedValueOnce([{
      uri: 'file:///ref.ts',
      range: { start: { line: 2, character: 2 }, end: { line: 2, character: 12 } }
    }]);

    const tools = createLspTools(mockClient);
    const refTool = tools.find(t => t.name === 'lsp_references');
    expect(refTool).toBeDefined();

    const result = await refTool!.call({ uri: 'file:///test.ts', line: 10, character: 5 });
    
    expect(mockSendRequest).toHaveBeenCalledWith(ReferencesRequest.type, {
      textDocument: { uri: 'file:///test.ts' },
      position: { line: 10, character: 5 },
      context: { includeDeclaration: true }
    });
    expect(result).toContain('file:///ref.ts');
  });

  test('tools return error message on exception', async () => {
    mockSendRequest.mockRejectedValueOnce(new Error('Connection lost'));

    const tools = createLspTools(mockClient);
    const hoverTool = tools.find(t => t.name === 'lsp_hover');
    const result = await hoverTool!.call({ uri: 'file:///test.ts', line: 10, character: 5 });
    
    expect(result).toBe('LSP error: Connection lost');
  });
});
