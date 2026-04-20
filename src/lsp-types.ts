import type { InitializeParams, InitializeResult, DocumentSymbol } from 'vscode-languageserver-protocol';

export interface LspClientOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface LspClientState {
  status: 'disconnected' | 'starting' | 'ready' | 'error' | 'stopped';
  capabilities?: InitializeResult['capabilities'];
}

export type { InitializeParams, InitializeResult, DocumentSymbol };
