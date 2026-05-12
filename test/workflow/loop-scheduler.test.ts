import { describe, it, expect } from 'bun:test';
import { LoopScheduler } from '../../src/workflow/loop-scheduler.js';

describe('LoopScheduler', () => {
  it('identifies the next missing planned change whose dependencies are met', async () => {
    const mockOutput = {
      valid: true,
      milestones: [
        {
          plannedChanges: [
            {
              id: 'already-done',
              path: 'path/to/already-done',
              state: 'archived',
              derivedStatus: 'complete'
            },
            {
              id: 'next-change',
              path: 'path/to/next-change',
              state: 'missing',
              derivedStatus: 'planned'
            }
          ]
        }
      ]
    };
    
    const cmd = `echo '${JSON.stringify(mockOutput)}'`;
    const scheduler = new LoopScheduler({ roadmapStatusCommand: cmd });
    const next = await scheduler.getNextChange();

    expect(next).toEqual({
      id: 'next-change',
      path: 'path/to/next-change'
    });
  });

  it('returns null if there are no missing planned changes', async () => {
    const mockOutput = {
      valid: true,
      milestones: [
        {
          plannedChanges: [
            {
              id: 'already-done',
              path: 'path/to/already-done',
              state: 'archived',
              derivedStatus: 'complete'
            }
          ]
        }
      ]
    };
    
    const cmd = `echo '${JSON.stringify(mockOutput)}'`;
    const scheduler = new LoopScheduler({ roadmapStatusCommand: cmd });
    const next = await scheduler.getNextChange();

    expect(next).toBeNull();
  });

  it('skips missing changes that are blocked', async () => {
    const mockOutput = {
      valid: true,
      milestones: [
        {
          plannedChanges: [
            {
              id: 'blocked-change',
              path: 'path/to/blocked',
              state: 'missing',
              derivedStatus: 'blocked'
            },
            {
              id: 'next-ready-change',
              path: 'path/to/ready',
              state: 'missing',
              derivedStatus: 'planned'
            }
          ]
        }
      ]
    };
    
    const cmd = `echo '${JSON.stringify(mockOutput)}'`;
    const scheduler = new LoopScheduler({ roadmapStatusCommand: cmd });
    const next = await scheduler.getNextChange();

    expect(next).toEqual({
      id: 'next-ready-change',
      path: 'path/to/ready'
    });
  });

  it('throws an error if the roadmap status command fails', async () => {
    const scheduler = new LoopScheduler({ roadmapStatusCommand: 'exit 1' });
    await expect(scheduler.getNextChange()).rejects.toThrow('Failed to read roadmap status');
  });
});
