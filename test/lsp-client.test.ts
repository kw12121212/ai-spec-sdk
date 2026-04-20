import { test, expect, describe, afterEach } from 'bun:test';
import { LspClient } from '../src/lsp-client.js';
import { writeFileSync, unlinkSync } from 'node:fs';

const dummyServerCode = `
let buffer = Buffer.alloc(0);
process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  const headerEnd = buffer.indexOf('\\r\\n\\r\\n');
  if (headerEnd !== -1) {
    const headersStr = buffer.toString('utf8', 0, headerEnd);
    const contentLengthMatch = headersStr.match(/Content-Length: (\\d+)/);
    if (contentLengthMatch) {
      const contentLength = parseInt(contentLengthMatch[1], 10);
      if (buffer.length >= headerEnd + 4 + contentLength) {
        const bodyStr = buffer.toString('utf8', headerEnd + 4, headerEnd + 4 + contentLength);
        const req = JSON.parse(bodyStr);
        if (req.method === 'initialize') {
          const res = {
            jsonrpc: '2.0',
            id: req.id,
            result: { capabilities: { hoverProvider: true } }
          };
          const resStr = JSON.stringify(res);
          const out = \`Content-Length: \${Buffer.byteLength(resStr)}\\r\\n\\r\\n\${resStr}\`;
          process.stdout.write(out);
        } else if (req.method === 'shutdown') {
          const res = {
            jsonrpc: '2.0',
            id: req.id,
            result: null
          };
          const resStr = JSON.stringify(res);
          const out = \`Content-Length: \${Buffer.byteLength(resStr)}\\r\\n\\r\\n\${resStr}\`;
          process.stdout.write(out);
        } else if (req.method === 'exit') {
          process.exit(0);
        }
        buffer = buffer.subarray(headerEnd + 4 + contentLength);
      }
    }
  }
});
`;

describe('LspClient', () => {
  let client: LspClient;

  afterEach(async () => {
    if (client) {
      await client.stop();
    }
    try { unlinkSync('dummy-server.js'); } catch (e) {}
  });

  test('should fail to start if process exits early', async () => {
    client = new LspClient({ command: 'node', args: ['-e', 'process.exit(1)'] });
    
    await expect(client.start({
      processId: null,
      rootUri: null,
      capabilities: {},
    })).rejects.toThrow(/exited early/);
    
    expect(client.getState().status).toBe('stopped');
  });

  test('should start and initialize with a dummy server', async () => {
    writeFileSync('dummy-server.js', dummyServerCode);

    client = new LspClient({
      command: 'node',
      args: ['dummy-server.js']
    });

    await client.start({
      processId: null,
      rootUri: null,
      capabilities: {},
    });

    expect(client.getState().status).toBe('ready');
    expect(client.getState().capabilities?.hoverProvider).toBe(true);
    
    expect(client.getConnection()).toBeDefined();
  });
});
