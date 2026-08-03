// Integration tests for memory pipeline
// Run with: npx tsx src/scripts/integrationMemoryTest.ts
//
// Tests:
//   1. PII filter — entity with phone number should be filtered out
//   2. Forbidden filter — greeting only should be filtered
//   3. Multi-session persistence — entities accumulate across extractions
//   4. /new reset — preserves L2 (entities), returns reset conversation
//   5. Retrieval — known entities are surfaced for related queries

import { filterContent } from '../agent/contentFilter.js';
import {
  upsertEntity,
  generateEntityKey,
  listEntitiesByCustomer,
  markForgotten,
  findEntityById,
} from '../data/memoryRepo.js';
import { upsertDoc, generateDocKey, listByChannel, findDocById } from '../data/businessDocRepo.js';
import { retrieveContext, ensureBusinessKBIndexes } from '../agent/contextRetriever.js';
import { PolarisPipeline, NEW_COMMAND } from '../agent/pipeline.js';
import { getEmbedder } from '../lib/embedder.js';
import { getQdrant, QDRANT_COLLECTIONS, ensureQdrantCollection } from '../lib/qdrant.js';

const CUSTOMER = 'cust_integ';
const CHANNEL = 'ch_integ';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string): void {
  if (condition) {
    passed++;
    console.log(`  PASS: ${msg}`);
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

async function testPIIFilter() {
  console.log('\n[1] PII filter');
  const phoneContent = '王小明 0912345678 喜歡壽司';
  const result = filterContent(phoneContent);
  assert(!result.passed, 'phone content should be flagged');
  assert(result.detectedPII.includes('taiwan_mobile'), 'should detect taiwan_mobile');

  const ccContent = '信用卡 4111-1111-1111-1111 過期了';
  const ccResult = filterContent(ccContent);
  assert(!ccResult.passed, 'credit card content should be flagged');
  assert(ccResult.detectedPII.includes('credit_card'), 'should detect credit_card');

  const safeContent = '王小明喜歡壽司';
  const safeResult = filterContent(safeContent);
  assert(safeResult.passed, 'safe content should pass');
  console.log('  ✓');
}

async function testForbiddenFilter() {
  console.log('\n[2] Forbidden filter (greetings)');
  const greetings = ['你好', '謝謝', '再見', 'Hello!', 'Thanks.', 'bye'];
  for (const g of greetings) {
    const r = filterContent(g);
    assert(!r.passed, `greeting "${g}" should be flagged`);
  }
  console.log('  ✓');
}

async function testMultiSessionPersistence() {
  console.log('\n[3] Multi-session persistence');
  await upsertEntity({
    _key: generateEntityKey(CUSTOMER, 'multi_session_test'),
    customerId: CUSTOMER,
    channelId: CHANNEL,
    name: 'multi_session_test',
    category: 'preference',
    content: '測試 entity 跨 session 持久化',
    evidence: 'test',
    confidence: 0.9,
    source: 'extracted',
  });
  const all = await listEntitiesByCustomer(CUSTOMER, { includeForgotten: false });
  assert(all.some((e) => e.name === 'multi_session_test'), 'entity should persist');
  console.log('  ✓');
}

async function testForgottenMark() {
  console.log('\n[4] Forgotten marking (forget-me)');
  const key = generateEntityKey(CUSTOMER, 'forgotten_test');
  await upsertEntity({
    _key: key,
    customerId: CUSTOMER,
    channelId: CHANNEL,
    name: 'forgotten_test',
    category: 'preference',
    content: '要被忘記的 entity',
    evidence: 'test',
    confidence: 0.9,
    source: 'extracted',
  });
  await markForgotten(key);
  const e = await findEntityById(key);
  assert(e?.forgotten === true, 'entity should be marked forgotten');
  const visible = await listEntitiesByCustomer(CUSTOMER, { includeForgotten: false });
  assert(!visible.some((m) => m._key === key), 'forgotten entity should not appear in default list');
  console.log('  ✓');
}

async function testNewCommandPreservesL2() {
  console.log('\n[5] /new preserves L2 (entities)');
  await upsertEntity({
    _key: generateEntityKey(CUSTOMER, 'preserved_across_new'),
    customerId: CUSTOMER,
    channelId: CHANNEL,
    name: 'preserved_across_new',
    category: 'preference',
    content: '/new 不應清除這個',
    evidence: 'test',
    confidence: 0.9,
    source: 'extracted',
  });

  const pipeline = new PolarisPipeline({ enableExtraction: false });
  const result = await pipeline.handleMessage({
    userId: CUSTOMER,
    channelId: CHANNEL,
    text: NEW_COMMAND,
  });
  assert(result.reset, '/new should reset');
  assert(result.resetConversation?.state === 'idle', 'reset conversation should be idle');

  const stillThere = await listEntitiesByCustomer(CUSTOMER, { includeForgotten: false });
  assert(stillThere.some((e) => e.name === 'preserved_across_new'), 'L2 entity should survive /new');
  console.log('  ✓');
}

async function testBusinessDocCRUD() {
  console.log('\n[6] Business Doc CRUD');
  const key = generateDocKey(CHANNEL, 'integ_test_doc');
  await upsertDoc({
    _key: key,
    channelId: CHANNEL,
    type: 'menu',
    title: '測試菜單',
    content: '套餐 A: $100 / 套餐 B: $200',
    tags: ['test', 'menu'],
    enabled: true,
  });
  await ensureBusinessKBIndexes(CHANNEL);
  const docs = await listByChannel(CHANNEL);
  assert(docs.some((d) => d._key === key), 'doc should appear in list');
  const fetched = await findDocById(key);
  assert(fetched?.title === '測試菜單', 'doc should be retrievable by key');
  console.log('  ✓');
}

async function testRetrievalSurfaceKnown() {
  console.log('\n[7] Retrieval surfaces known entities');
  const embedder = getEmbedder();
  const qdrant = getQdrant();
  await ensureQdrantCollection(QDRANT_COLLECTIONS.MEMORIES, embedder.vectorSize);
  await ensureQdrantCollection(QDRANT_COLLECTIONS.BUSINESS, embedder.vectorSize);

  const ctx = await retrieveContext(
    CUSTOMER,
    CHANNEL,
    '請給我套餐',
    { maxMemories: 3, maxKB: 3, reRankTopK: 5 }
  );
  assert(ctx.businessDocs.length > 0, 'retrieval should surface the menu doc for "套餐" query');
  console.log(`  retrieved ${ctx.memories.length} memories, ${ctx.businessDocs.length} kb`);
  console.log('  ✓');
}

async function main() {
  console.log('[integ] memory pipeline integration tests');
  await testPIIFilter();
  await testForbiddenFilter();
  await testMultiSessionPersistence();
  await testForgottenMark();
  await testNewCommandPreservesL2();
  await testBusinessDocCRUD();
  await testRetrievalSurfaceKnown();

  console.log(`\n[integ] ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('[integ] FATAL', e);
  process.exit(1);
});