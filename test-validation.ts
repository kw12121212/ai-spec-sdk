import { LoopScheduler } from './src/workflow/loop-scheduler.js';

async function main() {
  const scheduler = new LoopScheduler({
    roadmapStatusCommand: 'node /home/code/.agents/skills/strict-spec-auto/scripts/strict-spec-driven.js roadmap-status'
  });
  
  const next = await scheduler.getNextChange();
  console.log('Next change:', next);
}

main().catch(console.error);
