// Phase 1 verification: stateStore CRUD + TTL behavior (with channelId)
import { getConversationStore } from './src/agent/stateStore.js';

const STORE_CONFIG = { ttlSeconds: 5 };
const CHANNEL = 'channel_test_' + Date.now();

async function main() {
  const store = getConversationStore({ config: STORE_CONFIG });
  const userId = 'U_test_' + Date.now();
  const now = Date.now();

  const pingOk = await store.ping();
  console.log(`[1] ping: ${pingOk ? 'OK' : 'FAIL'}`);
  if (!pingOk) process.exit(1);

  const convId = 'conv_test_' + Date.now();
  const conv = {
    id: convId,
    userId,
    channelId: CHANNEL,
    state: 'idle' as const,
    history: [{ role: 'user' as const, content: 'hello', timestamp: now }],
    context: { foo: 'bar' },
    createdAt: now,
    updatedAt: now,
    expiresAt: now + 5000,
  };
  await store.create(conv);
  console.log(`[2] create: ${convId} OK`);

  const fetched = await store.get(convId, CHANNEL);
  if (!fetched) throw new Error('GET failed');
  if (fetched.userId !== userId) throw new Error('userId mismatch');
  if (fetched.history[0].content !== 'hello') throw new Error('history mismatch');
  console.log(`[3] get: ${convId} OK (state=${fetched.state}, history=${fetched.history.length})`);

  const userConvs = await store.listByUser(userId, CHANNEL);
  if (!userConvs.find((c) => c.id === convId)) throw new Error('LIST missing conv');
  console.log(`[4] listByUser: ${userConvs.length} conv(s) for ${userId} OK`);

  const updated = await store.update(convId, CHANNEL, {
    state: 'understanding',
    intent: { type: 'greeting' },
  });
  if (updated.state !== 'understanding') throw new Error('state not updated');
  if (!updated.intent) throw new Error('intent not set');
  console.log(`[5] update: state→understanding, intent=${updated.intent.type} OK`);

  await new Promise((r) => setTimeout(r, 2000));
  const touched = await store.touch(convId, CHANNEL);
  console.log(`[6] touch: refreshed, expiresAt delta=${touched.expiresAt - Date.now()}ms OK`);

  const deleted = await store.delete(convId, CHANNEL);
  if (!deleted) throw new Error('DELETE returned false');
  const afterDelete = await store.get(convId, CHANNEL);
  if (afterDelete !== null) throw new Error('DELETE did not remove');
  console.log(`[7] delete: ${convId} OK`);

  const expireId = 'conv_expire_' + Date.now();
  const expireConv = {
    id: expireId,
    userId,
    channelId: CHANNEL,
    state: 'idle' as const,
    history: [],
    context: {},
    createdAt: now,
    updatedAt: now,
    expiresAt: now + 2000,
  };
  await store.create(expireConv);
  console.log(`[8a] created ${expireId}, waiting 3s for TTL expire...`);
  await new Promise((r) => setTimeout(r, 3000));
  const afterExpire = await store.get(expireId, CHANNEL);
  if (afterExpire !== null) throw new Error('TTL did not expire');
  console.log(`[8b] TTL expired: ${expireId} is null OK`);

  const ghost = await store.get('conv_ghost_xxx', CHANNEL);
  if (ghost !== null) throw new Error('GET should return null for missing');
  console.log(`[9] get(nonexistent): null OK`);

  const crossChan = await store.get(convId, 'other_channel_xxx');
  if (crossChan !== null) throw new Error('GET should return null for wrong channel');
  console.log(`[10] get(wrongChannel): null OK (cross-channel blocked)`);

  await store.close();
  console.log('\nALL PHASE 1 CHECKS PASSED');
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});