// A1.4 verification: multi-channel webhook routing
import { upsertChannel, findChannelByDestination, ensureChannelsCollection } from './src/data/channelRepo.js';

const BASE = 'http://localhost:9091';

async function main() {
  await ensureChannelsCollection();

  const chan1Id = 'test_chan_alpha';
  const chan2Id = 'test_chan_beta';

  await upsertChannel({
    _key: chan1Id,
    channelId: chan1Id,
    destination: 'U_dest_alpha_123',
    businessOwnerId: 'owner_alpha',
    name: 'Test Channel Alpha',
    channelSecret: 'test_secret_alpha',
    accessToken: 'test_token_alpha',
    enabled: true,
  });
  await upsertChannel({
    _key: chan2Id,
    channelId: chan2Id,
    destination: 'U_dest_beta_456',
    businessOwnerId: 'owner_beta',
    name: 'Test Channel Beta',
    channelSecret: 'test_secret_beta',
    accessToken: 'test_token_beta',
    enabled: true,
  });
  console.log('[1] inserted 2 channels');

  const found1 = await findChannelByDestination('U_dest_alpha_123');
  const found2 = await findChannelByDestination('U_dest_beta_456');
  if (!found1 || found1.businessOwnerId !== 'owner_alpha') throw new Error('chan1 lookup failed');
  if (!found2 || found2.businessOwnerId !== 'owner_beta') throw new Error('chan2 lookup failed');
  console.log(`[2] lookup OK: chan1=${found1.businessOwnerId}, chan2=${found2.businessOwnerId}`);

  console.log('\n[3] POST webhook with destination=U_dest_alpha_123');
  const r1 = await fetch(`${BASE}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destination: 'U_dest_alpha_123',
      events: [{
        type: 'message',
        replyToken: 't_alpha',
        source: { userId: 'U_user_alpha_1' },
        message: { type: 'text', text: '/help' },
      }],
    }),
  });
  console.log(`  status: ${r1.status}`);

  console.log('\n[4] POST webhook with destination=U_dest_beta_456');
  const r2 = await fetch(`${BASE}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destination: 'U_dest_beta_456',
      events: [{
        type: 'message',
        replyToken: 't_beta',
        source: { userId: 'U_user_beta_1' },
        message: { type: 'text', text: '/help' },
      }],
    }),
  });
  console.log(`  status: ${r2.status}`);

  console.log('\n[5] POST webhook with unknown destination (fallback)');
  const r3 = await fetch(`${BASE}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destination: 'U_unknown_xxx',
      events: [{
        type: 'message',
        replyToken: 't_unk',
        source: { userId: 'U_user_unknown_1' },
        message: { type: 'text', text: '/help' },
      }],
    }),
  });
  console.log(`  status: ${r3.status}`);

  console.log('\n[6] POST webhook without destination (warn)');
  const r4 = await fetch(`${BASE}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      events: [{ type: 'message', replyToken: 't_nodest', source: { userId: 'U_x' }, message: { type: 'text', text: 'hi' } }],
    }),
  });
  console.log(`  status: ${r4.status}`);

  await new Promise((r) => setTimeout(r, 1500));

  console.log('\n[7] server logs:');
  const fs = await import('node:fs');
  const log = fs.readFileSync('/tmp/sam-server.log', 'utf8');
  const lines = log.split('\n').filter((l) => l.includes('webhook.handled') || l.includes('webhook.channel_not_registered') || l.includes('webhook.missing_destination'));
  lines.forEach((l) => console.log('  ' + l));
}

main().catch((e) => { console.error('FAIL:', e); process.exit(1); });