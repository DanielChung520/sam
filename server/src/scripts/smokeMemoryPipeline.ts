// Smoke test: exercise Altair memory extraction pipeline end-to-end
// Run with: npx tsx src/scripts/smokeMemoryPipeline.ts

import {
  ensureMemoryEntitiesCollection,
  upsertEntity,
  listEntitiesByCustomer,
  findEntityById,
  generateEntityKey,
} from '../data/memoryRepo.js';
import { ensureBusinessDocsCollection, upsertDoc, generateDocKey, listByChannel } from '../data/businessDocRepo.js';
import { getQdrant, QDRANT_COLLECTIONS, ensureQdrantCollection, ensurePayloadIndexes } from '../lib/qdrant.js';
import { getEmbedder } from '../lib/embedder.js';

const CUSTOMER = 'cust_smoke_test';
const CHANNEL = 'ch_smoke';

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

async function main() {
  console.log('[smoke] start');

  await ensureMemoryEntitiesCollection();
  await ensureBusinessDocsCollection();
  await ensurePayloadIndexes();

  const embedder = getEmbedder();
  console.log(`[smoke] embedder = ${embedder.name} (dim=${embedder.vectorSize})`);

  await ensureQdrantCollection(QDRANT_COLLECTIONS.MEMORIES, embedder.vectorSize);
  await ensureQdrantCollection(QDRANT_COLLECTIONS.BUSINESS, embedder.vectorSize);

  const emb1 = await embedder.embed('王小明喜歡日式料理');
  console.log(`[smoke] embedding dim = ${emb1.length}`);

  const key1 = generateEntityKey(CUSTOMER, 'food_preference_japanese');
  await upsertEntity({
    _key: key1,
    customerId: CUSTOMER,
    channelId: CHANNEL,
    name: 'food_preference_japanese',
    category: 'preference',
    content: '王小明喜歡日式料理',
    evidence: 'user: 我超愛吃日式料理',
    confidence: 0.9,
    source: 'extracted',
  });
  console.log(`[smoke] entity upserted: ${key1}`);

  const docKey = generateDocKey(CHANNEL, 'tokyo_menu');
  await upsertDoc({
    _key: docKey,
    channelId: CHANNEL,
    type: 'menu',
    title: '東京壽司套餐',
    content: '特上套餐 $1280，包括 12 貫握壽司 + 味噌湯',
    tags: ['sushi', 'japanese'],
    enabled: true,
  });
  console.log(`[smoke] business doc upserted: ${docKey}`);

  const qdrant = getQdrant();
  await qdrant.upsert(QDRANT_COLLECTIONS.MEMORIES, {
    points: [
      {
        id: hashKey(key1),
        vector: emb1,
        payload: {
          customerId: CUSTOMER,
          channelId: CHANNEL,
          category: 'preference',
          entityKey: key1,
          confidence: 0.9,
          updatedAt: Date.now(),
        },
      },
    ],
  });
  console.log('[smoke] entity synced to Qdrant');

  const retrieved = await findEntityById(key1);
  if (!retrieved) throw new Error('entity not found');
  console.log(`[smoke] retrieved entity: ${retrieved.name} (${retrieved.category}, confidence=${retrieved.confidence})`);

  const allEntities = await listEntitiesByCustomer(CUSTOMER);
  console.log(`[smoke] customer entities: ${allEntities.length}`);

  const docs = await listByChannel(CHANNEL);
  console.log(`[smoke] channel business docs: ${docs.length}`);

  const searchResult = await qdrant.search(QDRANT_COLLECTIONS.MEMORIES, {
    vector: emb1,
    filter: { must: [{ key: 'customerId', match: { value: CUSTOMER } }] },
    limit: 3,
  });
  console.log(`[smoke] Qdrant search hits: ${searchResult.length}`);

  console.log('[smoke] OK — pipeline functional (LLM call not exercised in smoke)');
  process.exit(0);
}

main().catch((e) => {
  console.error('[smoke] FAILED', e);
  process.exit(1);
});