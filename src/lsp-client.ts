import { spawn, ChildProcess } from 'node:child_process';
import {
  createProtocolConnection,
  StreamMessageReader,
  StreamMessageWriter,
  Logger,
  ProtocolConnection,
  InitializeRequest,
  InitializeParams,
  ExitNotification,
  ShutdownRequest,
} from 'vscode-languageserver-protocol/node.js';
import type { LspClientOptions, LspClientState } from './lsp-types.js';
import { EventEmitter } from 'node:events';

export class LspClient extends EventEmitter {
  private process?: ChildProcess;
  private connection?: ProtocolConnection;
  private state: LspClientState = { status: 'disconnected' };

  constructor(private options: LspClientOptions) {
    super();
  }

  public getState(): LspClientState {
    return this.state;
  }

  public async start(initializeParams: InitializeParams): Promise<void> {
    if (this.state.status !== 'disconnected') {
      throw new Error('LSP Client is already starting or running');
    }

    this.state.status = 'starting';
    this.emit('stateChange', this.state);

    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.options.command, this.options.args || [], {
          cwd: this.options.cwd,
          env: { ...process.env, ...this.options.env },
        });

        if (!this.process.stdout || !this.process.stdin) {
          throw new Error('Failed to spawn LSP process with standard IO streams');
        }

        this.process.on('error', (err) => {
          this.state.status = 'error';
          this.emit('stateChange', this.state);
          this.emit('error', err);
          if (this.connection) {
            this.connection.dispose();
            this.connection = undefined;
          }
          reject(err);
        });

        this.process.on('exit', (code) => {
          const previousStatus = this.state.status;
          this.state.status = 'stopped';
          this.emit('stateChange', this.state);
          this.emit('exit', code);
          if (previousStatus !== 'ready') {
            reject(new Error(`LSP process exited early with code \${code}`));
          }
        });

        const reader = new StreamMessageReader(this.process.stdout);
        const writer = new StreamMessageWriter(this.process.stdin);
        
        const logger: Logger = {
          error: (message) => console.error(message),
          warn: (message) => console.warn(message),
          info: (message) => console.info(message),
          log: (message) => console.log(message),
        };

        this.connection = createProtocolConnection(reader, writer, logger);
        
        this.connection.listen();

        // Initialize handshake
        setImmediate(() => {
          if (this.state.status === 'error') return;
          this.connection?.sendRequest(InitializeRequest.type, initializeParams).then((result) => {
            this.state.status = 'ready';
            this.state.capabilities = result.capabilities;
            this.emit('stateChange', this.state);
            resolve();
          }).catch((err) => {
            this.state.status = 'error';
            this.emit('stateChange', this.state);
            reject(err);
          });
        });
      } catch (err) {
        this.state.status = 'error';
        this.emit('stateChange', this.state);
        reject(err);
      }
    });
  }

  public async stop(): Promise<void> {
    if (this.state.status === 'disconnected' || this.state.status === 'stopped') {
      return;
    }

    if (this.connection) {
      try {
        await Promise.race([
          this.connection.sendRequest(ShutdownRequest.type),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Shutdown timeout')), 1000))
        ]);
        await this.connection.sendNotification(ExitNotification.type);
      } catch (e) {
        // Ignore errors during shutdown
      }
      this.connection.dispose();
      this.connection = undefined;
    }

    if (this.process) {
      this.process.kill();
      this.process = undefined;
    }
    
    this.state.status = 'stopped';
    this.emit('stateChange', this.state);
  }
  
  public getConnection(): ProtocolConnection {
    if (!this.connection || this.state.status !== 'ready') {
      throw new Error('LSP Connection is not ready');
    }
    return this.connection;
  }
}
