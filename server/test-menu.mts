// Menu flow E2E: / → 1 → 量子計算  vs  /search 量子計算

import { Agent } from './src/agent/agent.js';
import { resetAgent } from './src/agent/agent.js';

async function main() {
  resetAgent();
  const agent = new Agent();

  const userId = 'U_menu_' + Date.now();
  const channelId = 'channel_menu';

  console.log('\n=== Path A: / → 1 → 量子計算 ===');

  console.log('\n[A1] send "/"');
  const r1 = await agent.handleMessage({ userId, channelId, text: '/' });
  console.log(`  intent: ${r1.intent?.type}`);
  console.log(`  output:\n${r1.text.split('\n').map((l) => '    ' + l).join('\n')}`);

  console.log('\n[A2] send "1" (number reply)');
  const r2 = await agent.handleMessage({ userId, channelId, text: '1' });
  console.log(`  intent: ${r2.intent?.type}`);
  console.log(`  state: ${r2.state}`);
  console.log(`  output: ${r2.text}`);

  console.log('\n[A3] send "量子計算" (parameter, no slash)');
  const r3 = await agent.handleMessage({ userId, channelId, text: '量子計算' });
  console.log(`  intent: ${r3.intent?.type}`);
  console.log(`  artifacts: ${JSON.stringify(r3.artifacts)}`);
  console.log(`  output length: ${r3.text.length} chars`);
  console.log(`  output preview: ${r3.text.slice(0, 150)}…`);

  console.log('\n=== Path B: /search 量子計算 (direct slash) ===');
  const userId2 = 'U_direct_' + Date.now();
  const r4 = await agent.handleMessage({ userId: userId2, channelId, text: '/search 量子計算' });
  console.log(`  intent: ${r4.intent?.type}`);
  console.log(`  output length: ${r4.text.length} chars`);
  console.log(`  output preview: ${r4.text.slice(0, 150)}…`);

  console.log('\n=== Edge cases ===');
  const userId3 = 'U_edge_' + Date.now();

  console.log('\n[E1] send "9" without menu (should warn)');
  const e1 = await agent.handleMessage({ userId: userId3, channelId, text: '9' });
  console.log(`  intent: ${e1.intent?.type}`);
  console.log(`  output: ${e1.text.slice(0, 100)}`);

  console.log('\n[E2] send "/" then "3" then "AI 趨勢"');
  await agent.handleMessage({ userId: userId3, channelId, text: '/' });
  const e2a = await agent.handleMessage({ userId: userId3, channelId, text: '3' });
  console.log(`  3 → ${e2a.text}`);
  const e2b = await agent.handleMessage({ userId: userId3, channelId, text: 'AI 趨勢' });
  console.log(`  intent: ${e2b.intent?.type}`);
  console.log(`  output length: ${e2b.text.length} chars`);
  console.log(`  preview: ${e2b.text.slice(0, 150)}…`);

  const store = (await import('./src/agent/stateStore.js')).getConversationStore();
  await store.close();
  console.log('\nALL MENU E2E PATHS DONE');
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});