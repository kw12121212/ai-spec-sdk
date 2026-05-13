import { expect, test, describe, mock } from 'bun:test';
import { RecommendAutoPipeline } from '../../src/workflow/recommend-auto';

describe('RecommendAutoPipeline', () => {
  test('executes strict change lifecycle steps in order', async () => {
    const execMock = mock(async (command: string, options: any) => {
      return { stdout: '{}', stderr: '' };
    });

    const pipeline = new RecommendAutoPipeline({ 
      scriptPath: 'dummy.js', 
      cwd: '/tmp',
      execAsync: execMock as any
    });
    
    await pipeline.execute('my-change');

    expect(execMock).toHaveBeenCalledTimes(5);
    
    // Check call order
    const calls = execMock.mock.calls.map((call: any[]) => call[0]);
    expect(calls[0]).toBe('node dummy.js propose my-change');
    expect(calls[1]).toBe('node dummy.js apply my-change');
    expect(calls[2]).toBe('node dummy.js verify my-change');
    expect(calls[3]).toBe('node dummy.js review my-change');
    expect(calls[4]).toBe('node dummy.js archive my-change');
  });
});