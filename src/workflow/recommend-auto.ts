import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface RecommendAutoOptions {
  cwd?: string;
  scriptPath?: string;
  execAsync?: (command: string, options: any) => Promise<{ stdout: string, stderr: string }>;
}

export class RecommendAutoPipeline {
  private cwd: string;
  private scriptPath: string;
  private execAsync: (command: string, options: any) => Promise<{ stdout: string, stderr: string }>;

  constructor(options?: RecommendAutoOptions) {
    this.cwd = options?.cwd || process.cwd();
    this.scriptPath = options?.scriptPath || 'scripts/strict-spec-driven.js';
    this.execAsync = options?.execAsync || promisify(exec);
  }

  private async runCommand(args: string): Promise<void> {
    try {
      await this.execAsync(`node ${this.scriptPath} ${args}`, { cwd: this.cwd });
    } catch (error) {
      throw new Error(`Command failed: node ${this.scriptPath} ${args}\n${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Executes the strict change lifecycle in order: propose, apply (implement), verify, review, archive.
   * Note: In a real environment, 'apply' might be called multiple times.
   */
  async execute(changeName: string): Promise<void> {
    // Propose the change
    await this.runCommand(`propose ${changeName}`);
    
    // Implement (apply) the change
    await this.runCommand(`apply ${changeName}`);
    
    // Verify the change
    await this.runCommand(`verify ${changeName}`);
    
    // Review the change
    await this.runCommand(`review ${changeName}`);
    
    // Archive the change
    await this.runCommand(`archive ${changeName}`);
  }
}
