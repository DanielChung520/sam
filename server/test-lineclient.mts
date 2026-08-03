// lineClient 單元測試 — 驗證 channel 快取、正確建立 client
//
// 需要：ArangoDB 在線（讀 channels collection）

import 'dotenv/config';
import { getClientForChannel, getClientByChannelKey, getClientByChannel, getBootClient, invalidateLineClientCache } from './src/lib/lineClient.js';

function fail(msg: string): never {
  throw new Error(`FAIL: ${msg}`);
}

async function main() {
  const { ensureChannelsCollection, upsertChannel, deleteChannel } = await import('./src/data/channelRepo.js');
  await ensureChannelsCollection();
  const testChannel = {
    _key: 'line_client_test',
    channelId: 'line_client_test_id',
    name: 'LineClient Test',
    channelSecret: 'test-secret',
    accessToken: 'test-token',
    destination: 'U_line_client_dest',
    businessOwnerId: 'admin',
    enabled: true,
    linkedAgentKey: '',
  };
  await upsertChannel(testChannel as any).catch(() => {});

  const byDest = await getClientForChannel('U_line_client_dest');
  if (!byDest) fail('getClientForChannel returned null');
  if (!byDest.client) fail('no messaging client');
  if (!byDest.blobClient) fail('no blob client');
  console.log('[1] getClientForChannel → client + blobClient OK');

  const byKey = await getClientByChannelKey('line_client_test');
  if (!byKey) fail('getClientByChannelKey returned null');
  console.log('[2] getClientByChannelKey → OK');

  const direct = getClientByChannel(testChannel as any);
  if (!direct.client || !direct.blobClient) fail('getClientByChannel missing clients');
  console.log('[3] getClientByChannel → OK');

  const missing = await getClientForChannel('U_nonexistent_dest');
  if (missing !== null) fail('missing channel should return null');
  console.log('[4] missing channel → null OK');

  const boot = getBootClient();
  console.log(`[5] boot client: ${boot ? 'OK' : 'null (no env token, acceptable)'}`);

  const again = await getClientForChannel('U_line_client_dest');
  if (again?.client !== byDest.client) fail('cache not working: different client instance');
  console.log('[6] cache reuse OK');

  invalidateLineClientCache();
  const afterInvalidate = await getClientForChannel('U_line_client_dest');
  if (afterInvalidate?.client === byDest.client) fail('invalidate not working');
  console.log('[7] invalidate → new instance OK');

  await deleteChannel('line_client_test');

  console.log('\nALL LINE CLIENT CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
