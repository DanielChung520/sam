// E2E test: simulate multi-turn conversation via Agent
// 直接呼叫 Agent.handleMessage()，不走 webhook/LINE

import { Agent } from './src/agent/agent.js';
import { getConversationStore } from './src/agent/stateStore.js';
import { getRateLimiter } from './src/agent/rateLimiter.js';
import { resetAgent } from './src/agent/agent.js';

async function main() {
  const agent = new Agent();
  resetAgent();

  const userId = 'U_e2e_' + Date.now();
  const channelId = 'channel_e2e';
  const convIds = new Set<string>();

  console.log('\n=== Turn 1: greeting ===');
  const r1 = await agent.handleMessage({
    userId,
    channelId,
    text: '你好',
  });
  convIds.add(r1.conversationId);
  console.log(`  intent: ${r1.intent?.type}`);
  console.log(`  state: ${r1.state}`);
  console.log(`  output: ${r1.text.slice(0, 80)}…`);

  console.log('\n=== Turn 2: slash command /help ===');
  const r2 = await agent.handleMessage({
    userId,
    channelId,
    text: '/help',
  });
  convIds.add(r2.conversationId);
  console.log(`  intent: ${r2.intent?.type}`);
  console.log(`  output: ${r2.text.slice(0, 80)}…`);

  console.log('\n=== Turn 3: slash command /search (taskforge) ===');
  const r3 = await agent.handleMessage({
    userId,
    channelId,
    text: '/search 什麼是 transformer architecture',
  });
  convIds.add(r3.conversationId);
  console.log(`  intent: ${r3.intent?.type}`);
  console.log(`  artifacts: ${JSON.stringify(r3.artifacts)}`);
  console.log(`  output length: ${r3.text.length} chars`);
  console.log(`  output preview: ${r3.text.slice(0, 120)}…`);

  console.log('\n=== Turn 4: same user, follow_up ===');
  const r4 = await agent.handleMessage({
    userId,
    channelId,
    text: '再多說一點',
  });
  convIds.add(r4.conversationId);
  console.log(`  intent: ${r4.intent?.type}`);
  console.log(`  output: ${r4.text.slice(0, 100)}…`);

  console.log('\n=== Turn 5: chitchat ===');
  const r5 = await agent.handleMessage({
    userId,
    channelId,
    text: '哈哈謝謝',
  });
  convIds.add(r5.conversationId);
  console.log(`  intent: ${r5.intent?.type}`);
  console.log(`  output: ${r5.text.slice(0, 80)}…`);

  console.log('\n=== Verification: state in Redis ===');
  const store = getConversationStore();
  const convs = await store.listByUser(userId, channelId);
  console.log(`  conversations: ${convs.length}`);
  if (convs.length > 0) {
    const c = convs[0];
    console.log(`  history length: ${c.history.length}`);
    console.log(`  state: ${c.state}`);
  }

  console.log('\n=== Verification: rate limiter ===');
  const limiter = getRateLimiter({ maxRequests: 3, windowSec: 60 });
  const rlUserId = 'U_ratelimit_' + Date.now();
  for (let i = 0; i < 5; i++) {
    const r = await limiter.check(rlUserId);
    console.log(`  request ${i + 1}: allowed=${r.allowed}, count=${r.count}, remaining=${r.remaining}`);
  }
  await limiter.reset(rlUserId);

  await store.close();
  console.log('\nALL E2E TURNS COMPLETED');
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});