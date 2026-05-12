import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface PlannedChangeRef {
  id: string;
  path: string;
}

export interface LoopSchedulerOptions {
  /**
   * The command to execute to get the roadmap status.
   * Defaults to 'node scripts/strict-spec-driven.js roadmap-status'
   */
  roadmapStatusCommand?: string;
  /**
   * The working directory to execute the command in.
   * Defaults to process.cwd()
   */
  cwd?: string;
}

export class LoopScheduler {
  private command: string;
  private cwd: string;

  constructor(options?: LoopSchedulerOptions) {
    this.command = options?.roadmapStatusCommand || 'node scripts/strict-spec-driven.js roadmap-status';
    this.cwd = options?.cwd || process.cwd();
  }

  /**
   * Reads the current roadmap state and identifies the next missing planned change.
   * @returns The identifier and path of the next missing planned change, or null if none are available.
   */
  async getNextChange(): Promise<PlannedChangeRef | null> {
    try {
      const { stdout } = await execAsync(this.command, { cwd: this.cwd });
      const status = JSON.parse(stdout);

      if (!status.valid || !Array.isArray(status.milestones)) {
        return null;
      }

      for (const milestone of status.milestones) {
        if (!Array.isArray(milestone.plannedChanges)) continue;
        
        for (const change of milestone.plannedChanges) {
          if (change.state === 'missing' && change.derivedStatus !== 'blocked') {
            return {
              id: change.id,
              path: change.path
            };
          }
        }
      }

      return null;
    } catch (error) {
      throw new Error(`Failed to read roadmap status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
