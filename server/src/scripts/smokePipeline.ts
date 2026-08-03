// Smoke test: exercise PolarisPipeline (/new + retrieval)
// Run with: npx tsx src/scripts/smokePipeline.ts

import { PolarisPipeline } from '../agent/pipeline.js';
import { listEntitiesByCustomer } from '../data/memoryRepo.js';

const CUSTOMER = 'cust_pipeline_smoke';
const CHANNEL = 'ch_pipeline_smoke';

async function main() {
  console.log('[pipeline-smoke] start');

  const pipeline = new PolarisPipeline({
    enableExtraction: false,
  });

  console.log('[pipeline-smoke] test 1: /new command');
  const resetResult = await pipeline.handleMessage({
    userId: CUSTOMER,
    channelId: CHANNEL,
    text: '/new',
  });
  console.log(`  reset=${resetResult.reset}, text="${resetResult.text}"`);
  if (!resetResult.reset) throw new Error('/new should trigger reset');
  if (!resetResult.text.includes('重新開始')) throw new Error('/new response missing greeting');
  if (!resetResult.resetConversation) throw new Error('resetConversation payload missing');
  console.log('  PASS');

  console.log('[pipeline-smoke] test 2: normal message → retrieval runs');
  const normalResult = await pipeline.handleMessage({
    userId: CUSTOMER,
    channelId: CHANNEL,
    text: '你好',
  });
  console.log(`  reset=${normalResult.reset}, intent=${JSON.stringify(normalResult.intent)}`);
  if (normalResult.reset) throw new Error('normal message should not reset');
  if (!normalResult.text) throw new Error('agent should produce text');
  console.log('  PASS');

  console.log('[pipeline-smoke] test 3: customer entity isolation (should be empty)');
  const entities = await listEntitiesByCustomer(CUSTOMER);
  console.log(`  customer entities: ${entities.length}`);
  if (entities.length !== 0) throw new Error('expected 0 entities (extraction disabled in smoke)');
  console.log('  PASS');

  console.log('[pipeline-smoke] test 4: bare / shows menu');
  const menuResult = await pipeline.handleMessage({
    userId: CUSTOMER,
    channelId: CHANNEL,
    text: '/',
  });
  if (!menuResult.slashMenuShown) throw new Error('bare / should set slashMenuShown');
  if (!menuResult.text.includes('可用功能')) throw new Error('menu text missing header');
  if (!menuResult.text.includes('/Polaris')) throw new Error('menu missing Polaris');
  console.log(`  menu text length: ${menuResult.text.length}`);
  console.log('  PASS');

  console.log('[pipeline-smoke] test 5: /polaris routes to main agent');
  const polarisResult = await pipeline.handleMessage({
    userId: CUSTOMER,
    channelId: CHANNEL,
    text: '/polaris 自我介紹一下',
  });
  if (!polarisResult.slashTarget) throw new Error('/polaris should resolve to slashTarget');
  if (polarisResult.slashTarget.name !== 'Polaris') throw new Error('wrong target');
  if (polarisResult.slashTarget.type !== 'main_agent') throw new Error('wrong type');
  console.log(`  target=${polarisResult.slashTarget.name} type=${polarisResult.slashTarget.type}`);
  console.log('  PASS');

  console.log('[pipeline-smoke] test 6: /rigel routes to sub-agent');
  const rigelResult = await pipeline.handleMessage({
    userId: CUSTOMER,
    channelId: CHANNEL,
    text: '/rigel 找資料',
  });
  if (!rigelResult.slashTarget) throw new Error('/rigel should resolve');
  if (rigelResult.slashTarget.name !== 'Rigel') throw new Error('wrong target');
  if (rigelResult.slashTarget.type !== 'sub_agent') throw new Error('wrong type');
  console.log(`  target=${rigelResult.slashTarget.name} type=${rigelResult.slashTarget.type}`);
  console.log('  PASS');

  console.log('[pipeline-smoke] test 7: /zzzz unknown command shows error');
  const unknownResult = await pipeline.handleMessage({
    userId: CUSTOMER,
    channelId: CHANNEL,
    text: '/zzzz',
  });
  if (unknownResult.slashTarget) throw new Error('unknown should not resolve');
  if (!unknownResult.text.includes('找不到')) throw new Error('unknown should show error');
  console.log('  PASS');

  console.log('[pipeline-smoke] OK');
  process.exit(0);
}

main().catch((e) => {
  console.error('[pipeline-smoke] FAILED', e);
  process.exit(1);
});