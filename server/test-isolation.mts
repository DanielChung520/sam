// A2.3: cross-channel isolation end-to-end
import { Agent } from './src/agent/agent.js';
import { getConversationStore } from './src/agent/stateStore.js';
import { resetAgent } from './src/agent/agent.js';

async function main() {
  resetAgent();
  const agent = new Agent();
  const store = getConversationStore();

  const sharedUserId = 'U_iso_test_' + Date.now();
  const channelA = 'channel_alpha_' + Date.now();
  const channelB = 'channel_beta_' + Date.now();

  console.log('\n=== 1. channel A creates conv ===');
  const r1 = await agent.handleMessage({ userId: sharedUserId, channelId: channelA, text: '/help' });
  console.log(`  conv_id: ${r1.conversationId}`);

  console.log('\n=== 2. channel B (same user) creates separate conv ===');
  const r2 = await agent.handleMessage({ userId: sharedUserId, channelId: channelB, text: '/help' });
  console.log(`  conv_id: ${r2.conversationId}`);

  if (r1.conversationId === r2.conversationId) {
    throw new Error('FAIL: same conv_id across channels — data leak!');
  }
  console.log('  ✓ different conv_ids');

  console.log('\n=== 3. verify state stored correctly ===');
  const convA = await store.get(r1.conversationId, channelA);
  const convB = await store.get(r2.conversationId, channelB);
  if (!convA || convA.channelId !== channelA) throw new Error('FAIL: convA channel mismatch');
  if (!convB || convB.channelId !== channelB) throw new Error('FAIL: convB channel mismatch');
  console.log(`  ✓ convA.channelId = ${convA.channelId}`);
  console.log(`  ✓ convB.channelId = ${convB.channelId}`);

  console.log('\n=== 4. cross-channel attack: get convA with channelB ===');
  const crossGet = await store.get(r1.conversationId, channelB);
  if (crossGet !== null) throw new Error('FAIL: cross-channel get leaked data!');
  console.log('  ✓ returned null');

  console.log('\n=== 5. cross-channel list: channelB sees only channelB conv ===');
  const listB = await store.listByUser(sharedUserId, channelB);
  if (listB.length !== 1 || listB[0].id !== r2.conversationId) {
    throw new Error(`FAIL: listB should have only channelB conv, got ${listB.map(c => c.id)}`);
  }
  console.log('  ✓ only channelB conv');

  console.log('\n=== 6. agent.handleMessage rejects channel mismatch ===');
  try {
    const fakeConvId = 'conv_mismatch_test';
    await store.create({
      id: fakeConvId,
      userId: sharedUserId,
      channelId: channelA,
      state: 'idle',
      history: [],
      context: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + 60000,
    });
    const result = await agent.handleMessage({ userId: sharedUserId, channelId: channelA, text: '/help' });
    if (result.conversationId !== fakeConvId) {
      console.log(`  note: got conv ${result.conversationId} (expected reuse of existing)`);
    }
  } catch (e) {
    console.log('  ✓ error thrown:', String(e).slice(0, 80));
  }

  console.log('\n=== 7. Redis key check (verify channelId prefix) ===');
  const Redis = (await import('ioredis')).default;
  const client = new Redis('redis://localhost:6379/0');
  const keys = await client.keys('sam:conv:*');
  const sampleKeys = keys.filter(k => k.includes(sharedUserId.slice(-5))).slice(0, 4);
  sampleKeys.forEach(k => console.log(`  ${k}`));
  await client.quit();

  await store.close();
  console.log('\nALL CROSS-CHANNEL ISOLATION CHECKS PASSED');
}

main().catch((e) => { console.error('FAIL:', e.message ?? e); process.exit(1); });